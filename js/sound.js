// The sound engine: real sampled instruments (General MIDI soundfonts, loaded on demand) with a synthesizer to fall back
// on, synthesized drums, the AI singer, a mixer with reverb, a look-ahead scheduler, and offline rendering to WAV.
import { singNote } from './voice.js?v=1';

export const INSTRUMENTS = {
  piano: { n: ['鋼琴', 'Piano'], gm: 'acoustic_grand_piano', icon: '🎹', synth: 'piano' },
  epiano: { n: ['電鋼琴', 'E-Piano'], gm: 'electric_piano_1', icon: '🎹', synth: 'epiano' },
  guitar: { n: ['木吉他', 'Acoustic Guitar'], gm: 'acoustic_guitar_steel', icon: '🎸', synth: 'pluck' },
  nylon: { n: ['古典吉他', 'Nylon Guitar'], gm: 'acoustic_guitar_nylon', icon: '🎸', synth: 'pluck' },
  eguitar: { n: ['電吉他', 'Electric Guitar'], gm: 'electric_guitar_clean', icon: '🎸', synth: 'pluck' },
  overdrive: { n: ['破音吉他', 'Overdrive Guitar'], gm: 'overdriven_guitar', icon: '🤘', synth: 'saw' },
  bass: { n: ['電貝斯', 'Electric Bass'], gm: 'electric_bass_finger', icon: '🎸', synth: 'bass' },
  synthbass: { n: ['合成貝斯', 'Synth Bass'], gm: 'synth_bass_1', icon: '🔊', synth: 'bass' },
  strings: { n: ['弦樂團', 'Strings'], gm: 'string_ensemble_1', icon: '🎻', synth: 'pad' },
  violin: { n: ['小提琴', 'Violin'], gm: 'violin', icon: '🎻', synth: 'saw' },
  cello: { n: ['大提琴', 'Cello'], gm: 'cello', icon: '🎻', synth: 'saw' },
  flute: { n: ['長笛', 'Flute'], gm: 'flute', icon: '🪈', synth: 'sine' },
  sax: { n: ['薩克斯風', 'Saxophone'], gm: 'alto_sax', icon: '🎷', synth: 'saw' },
  trumpet: { n: ['小號', 'Trumpet'], gm: 'trumpet', icon: '🎺', synth: 'saw' },
  lead: { n: ['合成主音', 'Synth Lead'], gm: 'lead_2_sawtooth', icon: '⚡', synth: 'saw' },
  square: { n: ['方波電子', 'Square Lead'], gm: 'lead_1_square', icon: '👾', synth: 'square' },
  pad: { n: ['溫暖鋪底', 'Warm Pad'], gm: 'pad_2_warm', icon: '🌫️', synth: 'pad' },
  musicbox: { n: ['音樂盒', 'Music Box'], gm: 'music_box', icon: '🎁', synth: 'bell' },
  marimba: { n: ['木琴', 'Marimba'], gm: 'marimba', icon: '🪵', synth: 'bell' },
  choir: { n: ['人聲合唱鋪底', 'Choir Aahs'], gm: 'choir_aahs', icon: '👥', synth: 'pad' },
};
export const DRUMS = [
  { id: 'kick', n: ['大鼓', 'Kick'] }, { id: 'snare', n: ['小鼓', 'Snare'] }, { id: 'clap', n: ['拍手', 'Clap'] }, { id: 'hat', n: ['閉合鈸', 'Hi-hat'] }, { id: 'open', n: ['開放鈸', 'Open hat'] },
  { id: 'tomlo', n: ['低音筒鼓', 'Low tom'] }, { id: 'tomhi', n: ['高音筒鼓', 'High tom'] }, { id: 'crash', n: ['碎音鈸', 'Crash'] }, { id: 'rim', n: ['鼓邊', 'Rim'] }, { id: 'shaker', n: ['沙鈴', 'Shaker'] },
];
const SF = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const nameOf = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const audio = { ctx: null, master: null, rev: null, comp: null, loaded: {}, loading: {}, onLoad: null };
export function ensure() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return audio.ctx; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.ctx = ctx; Object.assign(audio, buildBus(ctx));
  return ctx;
}
// master bus: compressor, a little reverb send
function buildBus(ctx) {
  const master = ctx.createGain(); master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  const rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 2.2); const revOut = ctx.createGain(); revOut.gain.value = 0.9;
  rev.connect(revOut); revOut.connect(comp); master.connect(comp); comp.connect(ctx.destination);
  return { master, rev, comp };
}
function impulse(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1); }
  return b;
}

// ------------------------------------------------------------------ sampled instruments
// the soundfont file is a script holding base64 mp3s per note; decode them once and keep the buffers
export function loadInstrument(id) {
  const I = INSTRUMENTS[id]; if (!I || audio.loaded[id]) return Promise.resolve(audio.loaded[id]);
  if (audio.loading[id]) return audio.loading[id];
  const ctx = ensure();
  audio.loading[id] = fetch(SF + I.gm + '-mp3.js').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(async (txt) => {
    const re = /"([A-G]b?\d)":\s*"data:audio\/mp3;base64,([^"]+)"/g, jobs = []; let m;
    while ((m = re.exec(txt))) {
      const name = m[1], b64 = m[2];
      jobs.push((async () => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); try { return [name, await ctx.decodeAudioData(u8.buffer)]; } catch (e) { return [name, null]; } })());
    }
    const map = {}; for (const [name, buf] of await Promise.all(jobs)) if (buf) map[name] = buf;
    audio.loaded[id] = Object.keys(map).length ? map : 'synth';
    if (audio.onLoad) audio.onLoad(id);
    return audio.loaded[id];
  }).catch(() => { audio.loaded[id] = 'synth'; if (audio.onLoad) audio.onLoad(id); return 'synth'; });
  return audio.loading[id];
}
function playSample(ctx, out, map, midi, t, d, vel) {
  let m = midi, buf = map[nameOf(m)], shift = 0;
  for (let k = 1; !buf && k < 12; k++) { if (map[nameOf(m - k)]) { buf = map[nameOf(m - k)]; shift = k; break; } if (map[nameOf(m + k)]) { buf = map[nameOf(m + k)]; shift = -k; break; } }
  if (!buf) return false;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = Math.pow(2, shift / 12);
  const v = 0.18 + vel * 0.65, rel = 0.25;
  g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(0.0008, t + d + rel);
  src.connect(g); g.connect(out); src.start(t); src.stop(t + d + rel + 0.05);
  return true;
}
// the synthesizer that stands in until (or instead of) the samples
function playSynth(ctx, out, kind, midi, t, d, vel) {
  const f = mtof(midi), g = ctx.createGain(), v = 0.1 + vel * 0.25;
  const osc = (type, fr, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det; o.start(t); o.stop(t + d + 1.2); return o; };
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.connect(g); g.connect(out);
  let rel = 0.2;
  if (kind === 'piano' || kind === 'epiano' || kind === 'bell') {
    [1, 2, 3].forEach((h, i) => osc(kind === 'bell' ? 'sine' : i ? 'sine' : 'triangle', f * (kind === 'bell' ? [1, 2.76, 5.4][i] : h)).connect(lp));
    lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(800, t + 1.5);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(v * 0.25, t + Math.min(d, 1.2)); rel = kind === 'bell' ? 0.8 : 0.3;
  } else if (kind === 'pluck') {
    osc('sawtooth', f).connect(lp); lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.6);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(v * 0.05, t + Math.min(1.5, d + 0.3)); rel = 0.15;
  } else if (kind === 'bass') {
    osc('sawtooth', f).connect(lp); osc('sine', f / 2).connect(lp); lp.frequency.value = 700; lp.Q.value = 4; g.gain.setValueAtTime(v * 1.4, t); rel = 0.1;
  } else if (kind === 'pad') {
    [-8, 0, 8].forEach((det) => osc('sawtooth', f, det).connect(lp)); lp.frequency.value = 1800;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.6, t + 0.35); rel = 0.8;
  } else if (kind === 'sine') { osc('sine', f).connect(lp); lp.frequency.value = 6000; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); }
  else { osc(kind === 'square' ? 'square' : 'sawtooth', f).connect(lp); osc(kind === 'square' ? 'square' : 'sawtooth', f, 7).connect(lp); lp.frequency.value = 3200; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.7, t + 0.02); }
  g.gain.setValueAtTime(g.gain.value || v * 0.6, t + d); g.gain.exponentialRampToValueAtTime(0.0008, t + d + rel);
}
export function playNote(ctx, out, inst, midi, t, d, vel = 0.8) {
  const map = audio.loaded[inst];
  if (map && map !== 'synth' && playSample(ctx, out, map, midi, t, d, vel)) return;
  playSynth(ctx, out, (INSTRUMENTS[inst] || INSTRUMENTS.piano).synth, midi, t, d, vel);
}

// ------------------------------------------------------------------ drums (synthesized)
let nb = null;
const noiseSrc = (ctx) => { if (!nb || nb.sampleRate !== ctx.sampleRate) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ctx.createBufferSource(); s.buffer = nb; return s; };
export function playDrum(ctx, out, id, t, vel = 0.9) {
  const g = ctx.createGain(); g.connect(out); const v = vel;
  const tone = (type, f0, f1, len, lvl) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.6); og.gain.setValueAtTime(lvl * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 0.02); };
  const hiss = (type, f, q, len, lvl, at = 0) => { const s = noiseSrc(ctx), fl = ctx.createBiquadFilter(), ng = ctx.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; ng.gain.setValueAtTime(lvl * v, t + at); ng.gain.exponentialRampToValueAtTime(0.001, t + at + len); s.connect(fl); fl.connect(ng); ng.connect(g); s.start(t + at); s.stop(t + at + len + 0.02); };
  if (id === 'kick') { tone('sine', 150, 42, 0.45, 1.1); hiss('lowpass', 2500, 0.5, 0.02, 0.3); }
  else if (id === 'snare') { tone('triangle', 220, 160, 0.14, 0.45); hiss('bandpass', 1900, 0.7, 0.2, 0.7); }
  else if (id === 'clap') { for (const a of [0, 0.012, 0.024]) hiss('bandpass', 1300, 1.2, 0.03, 0.6, a); hiss('bandpass', 1300, 1.2, 0.18, 0.5, 0.034); }
  else if (id === 'hat') hiss('highpass', 7500, 0.8, 0.05, 0.35);
  else if (id === 'open') hiss('highpass', 7000, 0.8, 0.32, 0.3);
  else if (id === 'shaker') hiss('highpass', 5500, 1.5, 0.07, 0.2);
  else if (id === 'tomlo') tone('sine', 170, 90, 0.4, 0.8);
  else if (id === 'tomhi') tone('sine', 260, 150, 0.32, 0.7);
  else if (id === 'crash') hiss('highpass', 4500, 0.6, 1.4, 0.35);
  else if (id === 'rim') { tone('triangle', 900, 800, 0.05, 0.4); hiss('bandpass', 3000, 2, 0.03, 0.3); }
}

// ------------------------------------------------------------------ the mixer and the scheduler
// song: { bpm, bars, tracks: [{ type: 'inst'|'drums'|'vocal', inst, voice, vol, pan, mute, solo, rev, notes: [{ t, d, p, v, syl }] }] }
export const SPB = 16;   // steps per bar (sixteenth notes)
export const stepSec = (song) => 60 / song.bpm / 4;
function trackBus(ctx, master, rev, tr) {
  const g = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null, send = ctx.createGain();
  g.gain.value = tr.vol ?? 0.8; if (pan) pan.pan.value = tr.pan || 0;
  send.gain.value = tr.rev ?? (tr.type === 'vocal' ? 0.35 : tr.type === 'drums' ? 0.08 : 0.18);
  if (pan) { g.connect(pan); pan.connect(master); } else g.connect(master);
  g.connect(send); send.connect(rev);
  return g;
}
// schedule every note between two steps (used live in slices, and offline all at once)
function schedule(ctx, buses, song, fromStep, toStep, t0, sylFor) {
  const sp = stepSec(song), anySolo = song.tracks.some((x) => x.solo);
  song.tracks.forEach((tr, ti) => {
    if (tr.mute || (anySolo && !tr.solo)) return;
    const out = buses[ti];
    const notes = tr.notes.filter((n) => n.t >= fromStep && n.t < toStep).sort((a, b) => a.t - b.t);
    for (const n of notes) {
      const t = t0 + (n.t - fromStep) * sp, d = n.d * sp * 0.98;
      if (tr.type === 'drums') playDrum(ctx, out, DRUMS[n.p] ? DRUMS[n.p].id : 'kick', t, n.v ?? 0.9);
      else if (tr.type === 'vocal') { if (!n.hold) singNote(ctx, out, { t, d: d + holdLen(tr, n) * sp, midi: n.p, syl: sylFor(tr, n), voice: tr.voice, vel: n.v ?? 0.85, glideFrom: prevPitch(tr, n) }); }
      else playNote(ctx, out, tr.inst, n.p, t, d, n.v ?? 0.8);
    }
  });
}
// a note marked "~" in the lyrics holds the syllable before it
function holdLen(tr, n) { let extra = 0, at = n.t + n.d; for (;;) { const nx = tr.notes.find((x) => x.t === at && x.hold); if (!nx) return extra; extra += nx.d; at += nx.d; } }
function prevPitch(tr, n) { const p = tr.notes.filter((x) => x.t + x.d === n.t).sort((a, b) => b.t - a.t)[0]; return p ? p.p : null; }

export const player = { playing: false, startCtx: 0, startStep: 0, endStep: 0, loop: false, timer: null, buses: null, next: 0, onEnd: null };
export function play(song, fromStep, sylFor, o = {}) {
  const ctx = ensure(); stop();
  player.buses = song.tracks.map((tr) => trackBus(ctx, audio.master, audio.rev, tr));
  player.playing = true; player.loop = !!o.loop; player.startStep = fromStep; player.endStep = o.endStep || song.bars * SPB;
  player.startCtx = ctx.currentTime + 0.08; player.next = fromStep;
  const sp = stepSec(song);
  const tick = () => {
    const now = ctx.currentTime, horizon = now + 0.25;
    while (player.playing) {
      const stepT = player.startCtx + (player.next - player.startStep) * sp;
      if (stepT > horizon) break;
      if (player.next >= player.endStep) {
        if (player.loop) { player.startCtx = stepT; player.startStep = o.loopFrom ?? 0; player.next = player.startStep; continue; }
        if (now > stepT + 0.5) { stop(); if (player.onEnd) player.onEnd(); } break;
      }
      const to = Math.min(player.endStep, player.next + 4);
      schedule(ctx, player.buses, song, player.next, to, stepT, sylFor);
      player.next = to;
    }
  };
  tick(); player.timer = setInterval(tick, 40);
}
export function stop() {
  clearInterval(player.timer); player.playing = false;
  if (player.buses) for (const b of player.buses) { try { b.gain.cancelScheduledValues(0); b.gain.setValueAtTime(0, audio.ctx.currentTime); b.disconnect(); } catch (e) { /* gone */ } }
  player.buses = null;
}
export const position = (song) => (!player.playing ? null : player.startStep + Math.max(0, (audio.ctx.currentTime - player.startCtx) / stepSec(song)));

// ------------------------------------------------------------------ export: render the whole song offline to a WAV file
export async function renderWav(song, sylFor) {
  const sp = stepSec(song), secs = song.bars * SPB * sp + 2.5, rate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  const bus = buildBus(ctx), buses = song.tracks.map((tr) => trackBus(ctx, bus.master, bus.rev, tr));
  schedule(ctx, buses, song, 0, song.bars * SPB, 0.3, sylFor);
  const buf = await ctx.startRendering();
  return wavBlob(buf);
}
function wavBlob(buf) {
  const ch = buf.numberOfChannels, len = buf.length * ch * 2 + 44, ab = new ArrayBuffer(len), dv = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, len - 8, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, len - 44, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c)); let o = 44;
  for (let i = 0; i < buf.length; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}
// preview one note right away (when you click it in the editor)
export function preview(tr, midi, sylObj) {
  const ctx = ensure(), t = ctx.currentTime + 0.02, g = ctx.createGain(); g.gain.value = 0.8; g.connect(audio.master);
  if (tr.type === 'drums') playDrum(ctx, g, DRUMS[midi] ? DRUMS[midi].id : 'kick', t);
  else if (tr.type === 'vocal') singNote(ctx, g, { t: t + 0.1, d: 0.45, midi, syl: sylObj, voice: tr.voice, vel: 0.85 });
  else { loadInstrument(tr.inst); playNote(ctx, g, tr.inst, midi, t, 0.4, 0.8); }
}
