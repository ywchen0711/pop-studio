// Listening: record the microphone after a count-in, then turn a hummed tune into notes (pitch tracking with YIN,
// split into notes where the pitch moves or the voice re-attacks, quantized to the song's grid and key), or a beatboxed
// beat into drum hits (onsets from spectral flux, each one sorted into kick / snare / hi-hat by where its energy sits).
import { SPB, ensure, DRUMS } from './sound.js?v=1';
import { SCALES, KEYS } from './music.js?v=1';

// ------------------------------------------------------------------ recording
// o: { bars, bpm, clicks (a metronome during the take, best with headphones), onBeat(i, of, counting), onLevel(rms, midi) }
// resolves to { pcm, rate } for the take itself (the count-in is not included), and a stop() to end early
export function record(o) {
  const ctx = ensure(), beat = 60 / o.bpm, beats = o.bars * 4;
  let stream = null, src = null, proc = null, stopped = false, done;
  const chunks = [], finished = new Promise((r) => (done = r));
  const start = async () => {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    src = ctx.createMediaStreamSource(stream); proc = ctx.createScriptProcessor(2048, 1, 1);
    const sink = ctx.createGain(); sink.gain.value = 0; proc.connect(sink); sink.connect(ctx.destination); src.connect(proc);
    const lat = (ctx.baseLatency || 0.01) + 0.02;   // what the microphone hears now was sung a little earlier
    const t0 = ctx.currentTime + 0.3, rec0 = t0 + 4 * beat, rec1 = rec0 + beats * beat;
    // the count-in (four clicks, the first one higher), then optionally a quiet click on every beat
    for (let i = 0; i < 4 + (o.clicks ? beats : 0); i++) click(ctx, t0 + i * beat, i % 4 === 0 ? 1600 : 1100, i < 4 ? 0.35 : 0.12);
    for (let i = 0; i < 4 + beats; i++) setTimeout(() => !stopped && o.onBeat && o.onBeat(i < 4 ? 4 - i : i - 3, beats, i < 4), (t0 + i * beat - ctx.currentTime) * 1000);
    let n = 0;
    proc.onaudioprocess = (e) => {
      const x = e.inputBuffer.getChannelData(0), t = e.playbackTime - x.length / ctx.sampleRate - lat;
      if (t + x.length / ctx.sampleRate >= rec0 && t <= rec1) chunks.push({ t, x: new Float32Array(x) });
      if (o.onLevel && (n++ % 2 === 0)) { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; const rms = Math.sqrt(s / x.length), f = yinFrame(decimate(x), ctx.sampleRate / 2); o.onLevel(rms, f.conf > 0.82 && rms > 0.01 ? 69 + 12 * Math.log2(f.f0 / 440) : null); }
      if (ctx.currentTime > rec1 + 0.25 || stopped) finish();
    };
    function finish() {
      if (proc.onaudioprocess === null) return; proc.onaudioprocess = null;
      try { src.disconnect(); proc.disconnect(); } catch (e) { /* gone */ }
      stream.getTracks().forEach((tk) => tk.stop());
      // lay the chunks out on one timeline starting at the downbeat of the first recorded bar
      const rate = ctx.sampleRate, len = Math.ceil((rec1 - rec0) * rate), pcm = new Float32Array(len);
      for (const c of chunks) { const off = Math.round((c.t - rec0) * rate); for (let i = 0; i < c.x.length; i++) { const k = off + i; if (k >= 0 && k < len) pcm[k] = c.x[i]; } }
      done({ pcm, rate });
    }
  };
  return { started: start(), result: finished, stop: () => { stopped = true; } };
}
function click(ctx, t, f, g) { const o = ctx.createOscillator(), a = ctx.createGain(); o.frequency.value = f; a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.002); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.connect(a); a.connect(ctx.destination); o.start(t); o.stop(t + 0.08); }

// ------------------------------------------------------------------ pitch: YIN on one frame
function decimate(x) { const y = new Float32Array(x.length >> 1); for (let i = 0; i < y.length; i++) y[i] = 0.5 * (x[2 * i] + x[2 * i + 1]); return y; }
function yinFrame(x, rate, fmin = 70, fmax = 1100) {
  const W = x.length >> 1, tmin = Math.floor(rate / fmax), tmax = Math.min(W - 1, Math.ceil(rate / fmin)), d = new Float32Array(tmax + 1);
  for (let tau = 1; tau <= tmax; tau++) { let s = 0; for (let i = 0; i < W; i++) { const v = x[i] - x[i + tau]; s += v * v; } d[tau] = s; }
  // cumulative mean normalized difference; the first dip under the threshold is the period
  let run = 0, best = -1, bestV = 1;
  for (let tau = 1; tau <= tmax; tau++) { run += d[tau]; d[tau] = run > 0 ? d[tau] * tau / run : 1; }
  for (let tau = tmin; tau <= tmax; tau++) {
    if (d[tau] < 0.15) { while (tau + 1 <= tmax && d[tau + 1] < d[tau]) tau++; best = tau; bestV = d[tau]; break; }
    if (d[tau] < bestV) { bestV = d[tau]; best = tau; }
  }
  if (best < 2 || best >= tmax) return { f0: 0, conf: 0 };
  const a = d[best - 1], b = d[best], c = d[best + 1], sh = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { f0: rate / (best + (Math.abs(sh) < 1 ? sh : 0)), conf: 1 - bestV };
}
// the whole take: a frame every 10 ms
export function pitchTrack(pcm, rate) {
  const y = decimate(pcm), r = rate / 2, W = 1024, hop = Math.round(r * 0.01), frames = [];
  for (let s = 0; s + W <= y.length; s += hop) {
    const x = y.subarray(s, s + W); let e = 0; for (let i = 0; i < W; i++) e += x[i] * x[i];
    const rms = Math.sqrt(e / W), f = rms > 0.004 ? yinFrame(x, r) : { f0: 0, conf: 0 };
    frames.push({ t: (s + W / 2) / r, rms, f0: f.f0, conf: f.conf });
  }
  return frames;
}

// ------------------------------------------------------------------ hum -> notes
// o: { bpm, key, scale, snap (to the key), octave ('auto' brings the tune into the middle of the piano) }
export function humToNotes(pcm, rate, o) {
  const fr = pitchTrack(pcm, rate), stepSec = 60 / o.bpm / 4;
  // the noise floor from the quietest frames; voiced means clearly above it (and not far below the loudest singing)
  const sorted = fr.map((f) => f.rms).sort((a, b) => a - b), floor = sorted[Math.floor(sorted.length * 0.05)] || 0.001, loud = sorted[Math.floor(sorted.length * 0.95)] || 0.01;
  const gate = Math.max(0.006, Math.min(floor * 3, loud * 0.12));
  // pitch in semitones where voiced, smoothed with a median of five, octave slips folded back
  const m = fr.map((f) => (f.conf > 0.8 && f.rms > gate && f.f0 > 0 ? 69 + 12 * Math.log2(f.f0 / 440) : null));
  const med = m.map((v, i) => { if (v === null) return null; const w = m.slice(Math.max(0, i - 2), i + 3).filter((q) => q !== null).sort((a, b) => a - b); return w[w.length >> 1]; });
  for (let i = 1; i < med.length; i++) if (med[i] !== null && med[i - 1] !== null) { const dd = med[i] - med[i - 1]; if (Math.abs(Math.abs(dd) - 12) < 1.2) med[i] -= 12 * Math.sign(dd); }
  // notes: a run of voiced frames; a new note where the pitch settles somewhere else, or the voice re-attacks (a dip then a rise in loudness)
  const segs = []; let cur = null;
  const close = (i) => { if (cur && (i - cur.i0) * 0.01 >= 0.07) { cur.i1 = i; segs.push(cur); } cur = null; };
  for (let i = 0; i < med.length; i++) {
    const v = med[i];
    if (v === null) { if (cur && ++cur.gap > 3) close(i - cur.gap); continue; }
    if (cur) cur.gap = 0;
    const reattack = cur && i > 3 && fr[i].rms > 1.8 * Math.min(fr[i - 2].rms, fr[i - 3].rms) && fr[i - 2].rms < 0.7 * cur.peak;
    if (!cur) cur = { i0: i, ps: [v], peak: fr[i].rms, gap: 0 };
    else {
      const centre = cur.ps.slice().sort((a, b) => a - b)[cur.ps.length >> 1];
      const away = Math.abs(v - centre) > 0.75 && med.slice(i, i + 4).every((q) => q !== null && Math.abs(q - centre) > 0.6);
      if (away || reattack) { close(i); cur = { i0: i, ps: [v], peak: fr[i].rms, gap: 0 }; }
      else { cur.ps.push(v); cur.peak = Math.max(cur.peak, fr[i].rms); }
    }
  }
  close(med.length);
  if (!segs.length) return [];
  // pitches: the median of each note; the whole tune moved by octaves into the piano's middle
  let notes = segs.map((sg) => { const ps = sg.ps.slice().sort((a, b) => a - b); return { t0: fr[sg.i0].t - 0.02, t1: fr[Math.min(fr.length - 1, sg.i1)].t, p: ps[ps.length >> 1], v: Math.min(1, 0.55 + sg.peak * 4) }; });
  if (o.octave !== false) { const mid = notes.map((n) => n.p).sort((a, b) => a - b)[notes.length >> 1]; const sh = Math.round((67 - mid) / 12) * 12; notes.forEach((n) => (n.p += sh)); }
  const root = KEYS.indexOf(o.key), deg = SCALES[o.scale || 'major'];
  const snapKey = (p) => { let best = Math.round(p), bd = 99; for (let q = Math.floor(p) - 2; q <= Math.ceil(p) + 2; q++) if (deg.includes(((q - root) % 12 + 12) % 12) && Math.abs(q - p) < bd) { bd = Math.abs(q - p); best = q; } return best; };
  // on the grid: starts to the nearest sixteenth, lengths at least one, no overlaps
  const out = [];
  for (const n of notes) {
    const t = Math.max(0, Math.round(n.t0 / stepSec)), e = Math.max(t + 1, Math.round(n.t1 / stepSec)), p = o.snap ? snapKey(n.p) : Math.round(n.p);
    const prev = out[out.length - 1];
    if (prev && t < prev.t + prev.d) { if (prev.p === p) { prev.d = Math.max(prev.d, e - prev.t); continue; } prev.d = Math.max(1, t - prev.t); if (t <= prev.t) continue; }
    out.push({ t, d: e - t, p, v: Math.round(n.v * 100) / 100 });
  }
  return out.filter((n) => n.t < o.bars * SPB).map((n) => ({ ...n, d: Math.min(n.d, o.bars * SPB - n.t) }));
}

// ------------------------------------------------------------------ beatbox -> drum hits
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
export function beatToHits(pcm0, rate, o) {
  // a moment of silence in front, so a hit right on the first downbeat is seen arriving
  const N = 1024, hop = 256, pad = 2 * N, pcm = new Float32Array(pcm0.length + pad), win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)), frames = [];
  pcm.set(pcm0, pad);
  let prev = null;
  for (let s = 0; s + N <= pcm.length; s += hop) {
    const re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = pcm[s + i] * win[i];
    fft(re, im); const mag = new Float32Array(N / 2); for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    let flux = 0, e = 0; for (let k = 1; k < N / 2; k++) { const l = Math.log1p(mag[k] * 10); if (prev) flux += Math.max(0, l - prev[k]); e += mag[k] * mag[k]; }
    frames.push({ t: (s + N * 0.3 - pad) / rate, flux, e, mag }); prev = mag.map((v) => Math.log1p(v * 10));
  }
  // peaks of the flux above a moving threshold, at least 90 ms apart
  const fl = frames.map((f) => f.flux), hits = [], hz = rate / N, sortedE = frames.map((f) => f.e).sort((a, b) => a - b), eFloor = sortedE[Math.floor(sortedE.length * 0.3)] || 0;
  const sortedF = fl.slice().sort((a, b) => a - b), fBig = sortedF[Math.floor(sortedF.length * 0.97)] || 1;
  let last = -1;
  for (let i = 2; i < fl.length - 2; i++) {
    const nb = fl.slice(Math.max(0, i - 12), i + 12).sort((a, b) => a - b), thr = nb[nb.length >> 1] * 1.6 + 4;
    // a real hit: a clear peak, loud enough, and the sound actually getting louder (not the tail of the last hit wobbling)
    const rise = frames[i + 1].e > 2.5 * Math.min(frames[i - 2].e, frames[Math.max(0, i - 4)].e);
    if (fl[i] > thr && fl[i] > fBig * 0.2 && fl[i] >= fl[i - 1] && fl[i] >= fl[i + 1] && frames[i].t - last > 0.09 && frames[i + 1].e > eFloor * 6 && rise) {
      last = frames[i].t;
      // where the energy sits in the first 50 ms: low = kick, bright and noisy = hi-hat, in between = snare
      let lo = 0, mid = 0, hi = 0, tot = 0, cen = 0;
      for (let j = i; j < Math.min(frames.length, i + 4); j++) for (let k = 1; k < N / 2; k++) { const p = frames[j].mag[k] ** 2, f = k * hz; tot += p; cen += p * f; if (f < 180) lo += p; else if (f < 2500) mid += p; else if (f > 5000) hi += p; }
      cen /= tot || 1;
      // how long it rings (an open hat or a long "tssss")
      let len = 0; for (let j = i; j < frames.length && frames[j].e > frames[i + 1].e * 0.05; j++) len++;
      const kind = lo / tot > 0.38 && cen < 900 ? 'kick' : hi / tot > 0.32 || cen > 3800 ? (len * hop / rate > 0.17 ? 'open' : 'hat') : 'snare';
      hits.push({ t: frames[i].t, kind, v: Math.min(1, 0.5 + Math.sqrt(frames[i + 1].e) / 200) });
    }
  }
  const stepSec = 60 / o.bpm / 4, idx = Object.fromEntries(DRUMS.map((d, i) => [d.id, i])), out = new Map();
  for (const h of hits) { const t = Math.round(h.t / stepSec); if (t < 0 || t >= o.bars * SPB) continue; const p = idx[h.kind]; out.set(t + ':' + p, { t, d: 1, p, v: Math.round(h.v * 100) / 100 }); }
  return [...out.values()].sort((a, b) => a.t - b.t);
}
