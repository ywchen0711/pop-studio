// The AI singer: a formant singing synthesizer. Lyrics become syllables (Chinese through pinyin, English through
// spelling rules), each syllable becomes consonant noises and vowel shapes, and a voice source sings them at the
// note's pitch with vibrato, gliding from vowel to vowel. No samples and no server: it all runs in Web Audio.

// ------------------------------------------------------------------ vowels: formant frequencies (adult female) and levels
const V = {
  a: [850, 1220, 2810], ae: [860, 2050, 2850], e: [610, 1900, 2600], ee: [310, 2790, 3310], ih: [430, 2480, 3070],
  o: [520, 900, 2500], oo: [370, 950, 2670], uh: [720, 1350, 2780], er: [490, 1350, 1700], yu: [300, 2000, 2700],
  ez: [480, 1150, 2600],   // the Chinese "e" (喝 he)
  zi: [420, 1500, 2700],   // the buzzy "i" of 字 zi / 四 si
  ri: [440, 1550, 1900],   // the "i" of 日 ri / 知 zhi
  n: [280, 1600, 2600], ng: [280, 1100, 2400], m: [260, 1000, 2400], l: [380, 1250, 2600], r: [460, 1300, 1650], w: [330, 800, 2300], y: [300, 2500, 3200],
};
const NASAL = { n: 1, ng: 1, m: 1 };

// ------------------------------------------------------------------ Chinese: pinyin -> [onset consonant, vowel glides, coda]
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
const FINALS = {
  a: [['a']], o: [['o']], e: [['ez']], i: [['ee']], u: [['oo']], v: [['yu']], ai: [['a', 'ee']], ei: [['e', 'ee']], ao: [['a', 'oo']], ou: [['o', 'oo']],
  an: [['a'], 'n'], en: [['ez'], 'n'], ang: [['a'], 'ng'], eng: [['ez'], 'ng'], ong: [['oo'], 'ng'], er: [['er']],
  ia: [['ee', 'a']], ie: [['ee', 'e']], iao: [['ee', 'a', 'oo']], iu: [['ee', 'o', 'oo']], ian: [['ee', 'e'], 'n'], in: [['ee'], 'n'], iang: [['ee', 'a'], 'ng'], ing: [['ee'], 'ng'], iong: [['yu', 'oo'], 'ng'],
  ua: [['oo', 'a']], uo: [['oo', 'o']], uai: [['oo', 'a', 'ee']], ui: [['oo', 'e', 'ee']], uan: [['oo', 'a'], 'n'], un: [['oo', 'ez'], 'n'], uang: [['oo', 'a'], 'ng'], ueng: [['oo', 'ez'], 'ng'],
  ve: [['yu', 'e']], van: [['yu', 'e'], 'n'], vn: [['yu'], 'n'],
};
const YW = { yi: 'i', ya: 'ia', ye: 'ie', yao: 'iao', you: 'iu', yan: 'ian', yin: 'in', yang: 'iang', ying: 'ing', yong: 'iong', yu: 'v', yue: 've', yuan: 'van', yun: 'vn',
  wu: 'u', wa: 'ua', wo: 'uo', wai: 'uai', wei: 'ui', wan: 'uan', wen: 'un', wang: 'uang', weng: 'ueng' };
export function fromPinyin(py) {
  py = py.toLowerCase().replace(/ü|u:/g, 'v').replace(/[^a-z]/g, '');
  if (!py) return { c: '', v: ['a'], coda: '' };
  let ini = '', fin = py;
  if (YW[py]) { ini = py[0]; fin = YW[py]; }
  else for (const i of INITIALS) if (py.startsWith(i) && py.length > i.length) { ini = i; fin = py.slice(i.length); break; }
  if ('jqx'.includes(ini) && fin.startsWith('u')) fin = 'v' + fin.slice(1);
  let f = FINALS[fin] || FINALS[fin.replace(/^u/, 'v')] || [['a']];
  if (fin === 'i' && 'zcs'.includes(ini) && ini.length === 1) f = [['zi']];
  if (fin === 'i' && ['zh', 'ch', 'sh', 'r'].includes(ini)) f = [['ri']];
  return { c: ini === 'y' ? 'yglide' : ini === 'w' ? 'wglide' : ini, v: f[0], coda: f[1] || '' };
}

// ------------------------------------------------------------------ English: spelling -> rough sounds
const WORDS = {
  the: ['dh', ['uh']], a: ['', ['uh']], i: ['', ['a', 'ee']], you: ['y', ['oo']], your: ['y', ['o'], 'r'], my: ['m', ['a', 'ee']], me: ['m', ['ee']], we: ['w', ['ee']], be: ['b', ['ee']], to: ['t', ['oo']], do: ['d', ['oo']],
  love: ['l', ['uh'], 'v'], one: ['w', ['uh'], 'n'], heart: ['h', ['a'], 'rt'], night: ['n', ['a', 'ee'], 't'], light: ['l', ['a', 'ee'], 't'], lights: ['l', ['a', 'ee'], 'ts'], right: ['r', ['a', 'ee'], 't'], bright: ['br', ['a', 'ee'], 't'],
  are: ['', ['a'], 'r'], is: ['', ['ih'], 'z'], of: ['', ['uh'], 'v'], what: ['w', ['uh'], 't'], how: ['h', ['a', 'oo']], now: ['n', ['a', 'oo']], so: ['s', ['o', 'oo']], go: ['g', ['o', 'oo']], no: ['n', ['o', 'oo']], oh: ['', ['o', 'oo']],
  high: ['h', ['a', 'ee']], sky: ['sk', ['a', 'ee']], fly: ['fl', ['a', 'ee']], bye: ['b', ['a', 'ee']], eye: ['', ['a', 'ee']], world: ['w', ['er'], 'ld'], star: ['st', ['a'], 'r'], feel: ['f', ['ee'], 'l'], feet: ['f', ['ee'], 't'], beat: ['b', ['ee'], 't'], heat: ['h', ['ee'], 't'],
  come: ['k', ['uh'], 'm'], some: ['s', ['uh'], 'm'], done: ['d', ['uh'], 'n'], up: ['', ['uh'], 'p'], hands: ['h', ['ae'], 'ndz'], through: ['thr', ['oo']], till: ['t', ['ih'], 'l'], air: ['', ['e'], 'r'], there: ['dh', ['e'], 'r'], where: ['w', ['e'], 'r'],
};
function nucleus(g, long) {
  const map = { ee: 'ee', ea: 'ee', ie: 'ee', oo: 'oo', ou: ['a', 'oo'], ow: ['o', 'oo'], oi: ['o', 'ee'], oy: ['o', 'ee'], ai: ['e', 'ee'], ay: ['e', 'ee'], au: 'o', aw: 'o', ey: ['e', 'ee'], ei: ['e', 'ee'], ue: 'oo', ui: 'oo', oa: ['o', 'oo'], I: ['a', 'ee'], io: ['ee', 'o'], ia: ['ee', 'uh'], eo: ['ee', 'o'], y: long ? ['a', 'ee'] : ['ee'] };
  if (map[g]) return [].concat(map[g]);
  const c = g[0];
  if (c === 'a') return long ? ['e', 'ee'] : ['ae'];
  if (c === 'e') return long ? ['ee'] : ['e'];
  if (c === 'i') return long ? ['a', 'ee'] : ['ih'];
  if (c === 'o') return long ? ['o', 'oo'] : ['a'];
  if (c === 'u') return long ? ['oo'] : ['uh'];
  return ['uh'];
}
const ONSETS = new Set(['st', 'tr', 'dr', 'br', 'kr', 'pr', 'gr', 'fr', 'pl', 'bl', 'fl', 'kl', 'gl', 'sl', 'sh', 'ch', 'th', 'sk', 'sp', 'sw', 'tw', 'sm', 'sn', 'kw', 'dw', 'thr', 'str', 'spr', 'skr']);
// split an English word into sung syllables; a hyphen in the lyrics forces a break ("dia-mond")
export function englishSyllables(word) {
  const raw = word.toLowerCase().replace(/[^a-z'-]/g, '').replace(/'/g, '');
  if (!raw) return [];
  if (raw.includes('-')) return raw.split('-').filter(Boolean).map((p) => ({ ...syll(p), text: p }));
  if (WORDS[raw]) { const [c, v, coda] = WORDS[raw]; return [{ c, v, coda: coda || '', text: raw }]; }
  // spellings that sound like something else
  let w = raw.replace(/tch/g, 'ch').replace(/dge/g, 'j').replace(/ph/g, 'f').replace(/wh/g, 'w').replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/x/g, 'ks').replace(/igh/g, 'I').replace(/gh/g, '');
  let le = false, magic = false;
  if (/[^aeiouy]le$/.test(w) && w.length > 3) { w = w.slice(0, -2); le = true; }                       // twinkle -> twink + le
  else if (/[^aeiou]e$/.test(w) && /[aeiouyI]/.test(w.slice(0, -2))) { w = w.slice(0, -1); magic = true; }   // like, time, home
  w = w.replace(/c(?=[eiyI])/g, 's').replace(/c/g, 'k');
  // runs of consonants and vowels ("y" is a vowel unless it starts the word or follows a vowel)
  const runs = []; let i = 0;
  const vowelAt = (j) => 'aeiouI'.includes(w[j]) || (w[j] === 'y' && j > 0 && !'aeiou'.includes(w[j - 1]));
  while (i < w.length) { const v = vowelAt(i); let j = i; while (j < w.length && vowelAt(j) === v) j++; runs.push([v, w.slice(i, j)]); i = j; }
  const out = []; let onset = '';
  for (let r = 0; r < runs.length; r++) {
    const [isVow, txt] = runs[r];
    if (!isVow) {
      if (!out.length) { onset = txt; continue; }
      const nextV = runs[r + 1] && runs[r + 1][0];
      if (!nextV) { out[out.length - 1].coda += txt; continue; }
      // between two vowels: one consonant starts the next syllable; a cluster splits before a real onset
      if (txt.length === 1) onset = txt;
      else { const t3 = txt.slice(-3), t2 = txt.slice(-2); const take = txt.length >= 3 && ONSETS.has(t3) ? 3 : ONSETS.has(t2) ? 2 : 1; out[out.length - 1].coda += txt.slice(0, txt.length - take); onset = txt.slice(-take); }
      continue;
    }
    out.push({ c: onset, vtxt: txt, coda: '', text: raw }); onset = '';
  }
  out.forEach((o, k) => { const last = k === out.length - 1; if (o.vtxt === 'y') { o.v = out.length === 1 ? ['a', 'ee'] : ['ee']; delete o.vtxt; return; } o.v = nucleus(o.vtxt, (last && !o.coda && !le) || (last && magic)); delete o.vtxt; });
  if (le) out.push({ c: 'l', v: ['uh'], coda: '', text: raw });
  return out.length ? out : [{ c: '', v: ['uh'], coda: '', text: raw }];
}
function syll(p) { const s = englishSyllables(p); return { c: s[0].c, v: s.flatMap((x) => x.v).slice(0, 3), coda: s[s.length - 1].coda, text: p }; }

// ------------------------------------------------------------------ lyrics -> syllables
let pinyinLib = null;
async function pinyinOf(text) {
  if (!pinyinLib) { try { pinyinLib = await import('https://cdn.jsdelivr.net/npm/pinyin-pro@3.26.0/dist/index.mjs'); } catch (e) { pinyinLib = { pinyin: null }; } }
  if (!pinyinLib.pinyin) return [...text].map(() => 'a');
  return pinyinLib.pinyin(text, { toneType: 'none', type: 'array' });
}
const CJK = /[\u3400-\u9fff]/;
// "陽光灑在我的窗前" or "Twin-kle twin-kle lit-tle star" -> [{ text, c, v, coda }]; "~" or "-" alone holds the last syllable
export async function syllables(lyrics) {
  const out = [];
  const tokens = String(lyrics).replace(/[，。！？、,.!?;:"“”()（）\n]/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok === '~' || tok === '-' || tok === '_') { out.push({ hold: true, text: '~' }); continue; }
    if (CJK.test(tok)) {
      const chars = [...tok].filter((ch) => CJK.test(ch)), pys = await pinyinOf(chars.join(''));
      chars.forEach((ch, i) => out.push({ text: ch, ...fromPinyin(pys[i] || 'a') }));
    } else for (const s of englishSyllables(tok)) out.push(s);
  }
  return out;
}
// the text shown on each note: a Chinese character, a hyphenated part, or the word then "-" for its extra syllables
export const splitText = (lyrics) => String(lyrics).replace(/[，。！？、,.!?;:"“”()（）\n]/g, ' ').split(/\s+/).filter(Boolean).flatMap((tok) => (CJK.test(tok) ? [...tok].filter((c) => CJK.test(c)) : ['~', '-', '_'].includes(tok) ? ['~'] : tok.includes('-') ? tok.split('-').filter(Boolean) : englishSyllables(tok).map((s, i) => (i ? '-' : tok))));

// ------------------------------------------------------------------ the voice
export const VOICES = {
  girl: { n: ['甜美女聲', 'Sweet girl'], fmt: 1.0, vib: 0.35, breath: 0.05, wave: 'glottal', bright: 1 },
  boy: { n: ['溫暖男聲', 'Warm boy'], fmt: 0.84, vib: 0.3, breath: 0.04, wave: 'glottal', bright: 0.85, octave: -1 },
  kid: { n: ['童聲', 'Kid'], fmt: 1.14, vib: 0.2, breath: 0.03, wave: 'glottal', bright: 1.1, octave: 0 },
  robot: { n: ['機器人', 'Robot'], fmt: 1.0, vib: 0, breath: 0, wave: 'square', bright: 1.2 },
  choir: { n: ['合唱團', 'Choir'], fmt: 0.95, vib: 0.3, breath: 0.06, wave: 'glottal', bright: 0.9, chorus: 3 },
};
let glottal = null, noiseBuf = null;
function waveOf(ctx, kind) {
  if (kind === 'square') return null;
  if (!glottal || glottal.ctx !== ctx) {
    // a buzzy source with gently falling harmonics, close to a singing voice
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (1 / Math.pow(k, 1.15)) * (k % 2 ? 1 : 0.85);
    glottal = { ctx, w: ctx.createPeriodicWave(re, im) };
  }
  return glottal.w;
}
function noise(ctx) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// consonants: [type, centre frequency, level, length] ; types: fric (hiss), burst (plosive), asp (burst + breath), voiced (handled as a glide)
const CONS = {
  s: ['fric', 6000, 0.5, 0.09], z: ['fric', 5500, 0.35, 0.06], c: ['fric', 5800, 0.45, 0.08], x: ['fric', 4200, 0.45, 0.09], sh: ['fric', 2900, 0.5, 0.1], zh: ['fric', 2900, 0.3, 0.05], ch: ['fric', 3000, 0.45, 0.08],
  f: ['fric', 7000, 0.25, 0.08], v: ['fric', 6000, 0.15, 0.05], th: ['fric', 6500, 0.2, 0.07], dh: ['fric', 5000, 0.1, 0.03], h: ['fric', 1600, 0.2, 0.07], q: ['fric', 4000, 0.4, 0.07], j: ['fric', 3500, 0.25, 0.04],
  p: ['burst', 900, 0.5, 0.03], t: ['burst', 3800, 0.45, 0.025], k: ['burst', 1900, 0.45, 0.035], b: ['burst', 700, 0.3, 0.015], d: ['burst', 3200, 0.3, 0.015], g: ['burst', 1700, 0.3, 0.02],
};
const VOICED = { m: 'm', n: 'n', l: 'l', r: 'r', w: 'w', y: 'y', wglide: 'w', yglide: 'y', ng: 'ng' };
// split a consonant cluster ("str", "ch", "sh") into known pieces
function clusterOf(c) { const out = []; let s = c || ''; while (s) { const two = s.slice(0, 2); if (CONS[two] || VOICED[two]) { out.push(two); s = s.slice(2); } else { out.push(s[0]); s = s.slice(1); } } return out.filter((x) => CONS[x] || VOICED[x] || x === 'wglide' || x === 'yglide'); }

// sing one syllable on one note: { t start, d length (s), midi, syl, voice, vel }
export function singNote(ctx, out, n) {
  const P = VOICES[n.voice] || VOICES.girl, syl = n.syl || { v: ['a'], c: '', coda: '' }, t0 = n.t, d = Math.max(0.12, n.d), f0 = mtof(n.midi + (P.octave || 0) * 12), k = P.fmt;
  const pre = clusterOf(syl.c === 'yglide' || syl.c === 'wglide' ? syl.c[0] : syl.c);
  const preLen = pre.reduce((a, c) => a + (CONS[c] ? CONS[c][3] : 0.05), 0);
  const vStart = t0, vEnd = t0 + d;
  // the consonants come just before the beat, so the vowel lands on it
  let ct = vStart - Math.min(0.12, preLen);
  for (const c of pre) {
    if (CONS[c]) {
      const [type, fc, lv, len] = CONS[c], src = noise(ctx), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fc * (0.9 + 0.1 * k); bp.Q.value = type === 'burst' ? 1.2 : 2.5;
      g.gain.setValueAtTime(0, ct); g.gain.linearRampToValueAtTime(lv * (n.vel ?? 0.8), ct + Math.min(0.01, len / 3)); g.gain.setValueAtTime(lv * (n.vel ?? 0.8), ct + len * 0.6); g.gain.linearRampToValueAtTime(0, ct + len);
      src.connect(bp); bp.connect(g); g.connect(out); src.start(ct); src.stop(ct + len + 0.02);
      ct += len * 0.8;
    } else ct += 0.03;
  }
  const voices = P.chorus || 1;
  for (let vi = 0; vi < voices; vi++) {
    const det = voices > 1 ? (vi - (voices - 1) / 2) * 9 : 0, fk = k * (voices > 1 ? 1 + (vi - 1) * 0.04 : 1);
    const osc = ctx.createOscillator(), pw = waveOf(ctx, P.wave);
    if (pw) osc.setPeriodicWave(pw); else osc.type = 'square';
    // pitch: a small scoop up into the note, then vibrato that grows
    const prevF = n.glideFrom ? mtof(n.glideFrom + (P.octave || 0) * 12) : f0 * 0.97;
    osc.frequency.setValueAtTime(prevF, vStart - 0.02); osc.frequency.exponentialRampToValueAtTime(f0, vStart + 0.06);
    osc.detune.value = det;
    if (P.vib && d > 0.3) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.4 + Math.random() * 0.4; lg.gain.setValueAtTime(0, vStart); lg.gain.linearRampToValueAtTime(0, vStart + Math.min(0.25, d * 0.4)); lg.gain.linearRampToValueAtTime(f0 * 0.012 * P.vib * 2.2, vStart + Math.min(0.6, d * 0.8)); lfo.connect(lg); lg.connect(osc.frequency); lfo.start(vStart); lfo.stop(vEnd + 0.2); }
    // the mouth: three formant filters in parallel
    const mix = ctx.createGain(), amp = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 5200 * P.bright;
    const F = [0, 1, 2].map((i) => { const bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = [6, 9, 11][i]; g.gain.value = [1, 0.62, 0.3][i] * (i === 2 ? P.bright : 1); osc.connect(bp); bp.connect(g); g.connect(mix); return bp; });
    const setV = (name, at, glide = 0.04) => { const f = V[name] || V.a; F.forEach((bp, i) => bp.frequency.setTargetAtTime(f[i] * fk, at, glide)); };
    // voiced onsets (m, n, l, r, w, y) start in their own shape and slide into the vowel
    const vo = pre.find((c) => VOICED[c]);
    const vowels = syl.v && syl.v.length ? syl.v : ['a'];
    if (vo) setV(VOICED[vo], ct - 0.06, 0.005); else F.forEach((bp, i) => { const f = V[vowels[0]] || V.a; bp.frequency.setValueAtTime(f[i] * fk, vStart - 0.03); });
    // walk through the vowels: glides are short, the main vowel holds, the last one finishes the syllable
    const coda = syl.coda || '', codaLen = coda ? Math.min(0.12, d * 0.25) : 0, body = d - codaLen;
    const steps = vowels.length, mainIx = steps === 1 ? 0 : steps === 2 ? (['ee', 'oo', 'yu'].includes(vowels[0]) ? 1 : 0) : 1;
    let at = vStart;
    vowels.forEach((vw, i) => { setV(vw, at, i === 0 && !vo ? 0.01 : 0.035); at += i === mainIx ? body * (steps === 1 ? 1 : 0.6) : body * (steps === 1 ? 0 : 0.4 / (steps - 1)); });
    // nasal or consonant ending
    const nas = NASAL[coda] ? coda : /ng$/.test(coda) ? 'ng' : /n$/.test(coda) ? 'n' : /m$/.test(coda) ? 'm' : null;
    if (nas) setV(nas, vEnd - codaLen, 0.03);
    else if (/[lr]/.test(coda)) setV(coda.match(/[lr]/)[0], vEnd - codaLen, 0.04);
    // loudness: quick attack, a little swell, release
    const vel = (n.vel ?? 0.8) * (voices > 1 ? 0.55 : 1) * 0.5, endT = vEnd + (nas ? 0.05 : 0.02);
    amp.gain.setValueAtTime(0, vStart - 0.03); amp.gain.linearRampToValueAtTime(vel * (vo ? 0.6 : 1), vStart + 0.03); amp.gain.linearRampToValueAtTime(vel, vStart + 0.12);
    if (nas) amp.gain.setTargetAtTime(vel * 0.45, vEnd - codaLen, 0.03);
    amp.gain.setValueAtTime(nas ? vel * 0.45 : vel, endT - 0.06); amp.gain.linearRampToValueAtTime(0, endT + 0.04);
    mix.connect(lp); lp.connect(amp); amp.connect(out);
    // a breath of air on top of the voice
    if (P.breath) { const br = noise(ctx), bf = ctx.createBiquadFilter(), bg = ctx.createGain(); bf.type = 'bandpass'; bf.frequency.value = 2600 * fk; bf.Q.value = 0.8; bg.gain.setValueAtTime(0, vStart); bg.gain.linearRampToValueAtTime(P.breath * vel * 2, vStart + 0.05); bg.gain.linearRampToValueAtTime(0, endT); br.connect(bf); bf.connect(bg); bg.connect(out); br.start(vStart); br.stop(endT + 0.05); }
    osc.start(vStart - 0.03); osc.stop(endT + 0.08);
  }
  // consonants at the end of the syllable (t, s, k, ...)
  let et = vEnd - 0.02;
  for (const c of clusterOf(syl.coda).filter((x) => CONS[x])) {
    const [, fc, lv, len] = CONS[c], src = noise(ctx), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = 2;
    g.gain.setValueAtTime(0, et); g.gain.linearRampToValueAtTime(lv * 0.6 * (n.vel ?? 0.8), et + 0.01); g.gain.linearRampToValueAtTime(0, et + len);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(et); src.stop(et + len + 0.02); et += len * 0.7;
  }
}
