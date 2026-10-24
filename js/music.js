// Music theory and song making: keys and chords, automatic accompaniment in six styles, an AI melody that fits the
// lyrics, and the sample songs (original pop-style songs, plus folk tunes and nursery songs that belong to everyone).
import { SPB } from './sound.js?v=1';

export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export const noteName = (m) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1);
export const nm = (s) => { const m = String(s).match(/^([A-G][#b]?)(-?\d)$/); return m ? PC[m[1]] + (+m[2] + 1) * 12 : 60; };
export const inScale = (m, key, scale) => SCALES[scale].includes(((m - PC[key]) % 12 + 12) % 12);
// "Am7", "F", "G7", "Cmaj7", "Dsus4" -> { root pitch class, intervals }
export function chord(sym) {
  const m = String(sym || '').match(/^([A-G][#b]?)(maj7|m7|m|7|sus2|sus4|dim|add9)?$/); if (!m) return null;
  const q = m[2] || '', iv = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14] }[q];
  return { root: PC[m[1]], iv, sym };
}
// chords in a key by roman numeral
const ROMAN = { I: [0, ''], ii: [2, 'm'], iii: [4, 'm'], IV: [5, ''], V: [7, ''], vi: [9, 'm'], viio: [11, 'dim'], i: [0, 'm'], III: [3, ''], VI: [8, ''], VII: [10, ''], iv: [5, 'm'], v: [7, 'm'], ii7: [2, 'm7'], V7: [7, '7'], Imaj7: [0, 'maj7'], vi7: [9, 'm7'], IVmaj7: [5, 'maj7'] };
export const PROGRESSIONS = {
  pop: ['I', 'V', 'vi', 'IV'], sad: ['vi', 'IV', 'I', 'V'], fifties: ['I', 'vi', 'IV', 'V'], canon: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
  jazzy: ['ii7', 'V7', 'Imaj7', 'vi7'], royal: ['IVmaj7', 'V7', 'iii', 'vi'], rock: ['I', 'IV', 'V', 'IV'], minor: ['i', 'VI', 'III', 'VII'],
};
export const PROG_NAMES = { pop: ['流行四和弦 I–V–vi–IV', 'Pop I–V–vi–IV'], sad: ['抒情 vi–IV–I–V', 'Emotional vi–IV–I–V'], fifties: ['五〇年代 I–vi–IV–V', '50s I–vi–IV–V'], canon: ['卡農進行', 'Canon'], jazzy: ['爵士 ii–V–I', 'Jazzy ii–V–I'], royal: ['王道進行（日系）', 'Royal road (J-pop)'], rock: ['搖滾 I–IV–V', 'Rock I–IV–V'], minor: ['小調 i–VI–III–VII', 'Minor i–VI–III–VII'] };
export function progression(name, key, bars) {
  const p = PROGRESSIONS[name] || PROGRESSIONS.pop, out = [];
  for (let b = 0; b < bars; b++) { const [deg, q] = ROMAN[p[b % p.length]]; out.push(KEYS[(PC[key] + deg) % 12].replace('C#', 'Db').replace('F#', 'Gb') + q); }
  return out;
}
const voicing = (c, low = 57) => { const notes = c.iv.map((i) => c.root + i); return notes.map((n) => { let m = n; while (m < low) m += 12; while (m >= low + 12) m -= 12; return m; }).sort((a, b) => a - b); };

// ------------------------------------------------------------------ automatic accompaniment
export const STYLES = {
  pop: { n: ['流行', 'Pop'], bpm: 100 }, ballad: { n: ['抒情', 'Ballad'], bpm: 72 }, dance: { n: ['舞曲', 'Dance'], bpm: 124 },
  lofi: { n: ['Lo-fi', 'Lo-fi'], bpm: 80 }, synthwave: { n: ['復古電子', 'Synthwave'], bpm: 108 }, rock: { n: ['搖滾', 'Rock'], bpm: 132 },
};
const D = { kick: 0, snare: 1, clap: 2, hat: 3, open: 4, tomlo: 5, tomhi: 6, crash: 7, rim: 8, shaker: 9 };
// returns tracks: chords, bass, drums (and an arpeggio for some styles), for the chords given per bar
export function accompany(style, chords) {
  const bars = chords.length, chordT = { name: ['和弦', 'Chords'], type: 'inst', notes: [] }, bassT = { name: ['貝斯', 'Bass'], type: 'inst', notes: [] }, drumT = { name: ['鼓', 'Drums'], type: 'drums', inst: 'drums', notes: [] }, extra = [];
  const add = (tr, t, d, p, v = 0.8) => tr.notes.push({ t, d, p, v });
  const hit = (b, steps, drum, v = 0.9) => steps.forEach((s) => add(drumT, b * SPB + s, 1, D[drum], v));
  chords.forEach((sym, b) => {
    const c = chord(sym); if (!c) return; const v = voicing(c), root = c.root + 36, bt = b * SPB;
    if (style === 'pop') {
      chordT.inst = 'piano'; [0, 6, 8, 14].forEach((s, i) => v.forEach((p) => add(chordT, bt + s, i % 2 ? 2 : 4, p, 0.6)));
      bassT.inst = 'bass'; [0, 3, 6, 8, 11, 14].forEach((s, i) => add(bassT, bt + s, 2, root + (i === 4 ? 7 : 0), 0.85));
      hit(b, [0, 8, 10], 'kick'); hit(b, [4, 12], 'snare'); hit(b, [0, 2, 4, 6, 8, 10, 12, 14], 'hat', 0.55); if (b % 4 === 0) hit(b, [0], 'crash', 0.6);
    } else if (style === 'ballad') {
      chordT.inst = 'piano'; const arp = [v[0] - 12, v[0], v[1], v[2], v[1] + 12, v[2], v[1], v[0]]; arp.forEach((p, i) => add(chordT, bt + i * 2, 3, p, 0.55));
      bassT.inst = 'bass'; add(bassT, bt, 8, root, 0.75); add(bassT, bt + 8, 8, root + 7, 0.7);
      extra.strings = extra.strings || { name: ['弦樂', 'Strings'], type: 'inst', inst: 'strings', vol: 0.45, notes: [] }; v.forEach((p) => add(extra.strings, bt, 16, p + 12, 0.45));
      if (b > 1) { hit(b, [0], 'kick', 0.7); hit(b, [8], 'snare', 0.55); hit(b, [0, 4, 8, 12], 'shaker', 0.4); }
    } else if (style === 'dance') {
      chordT.inst = 'pad'; v.forEach((p) => add(chordT, bt, 16, p, 0.5));
      extra.stab = extra.stab || { name: ['合成和弦', 'Synth stabs'], type: 'inst', inst: 'lead', vol: 0.45, notes: [] }; [2, 6, 10, 14].forEach((s) => v.forEach((p) => add(extra.stab, bt + s, 1, p + 12, 0.5)));
      bassT.inst = 'synthbass'; [2, 6, 10, 14].forEach((s, i) => add(bassT, bt + s, 2, root + (i % 2 ? 12 : 0), 0.9));
      hit(b, [0, 4, 8, 12], 'kick'); hit(b, [4, 12], 'clap'); hit(b, [2, 6, 10, 14], 'open', 0.5); hit(b, [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], 'hat', 0.35); if (b % 8 === 0) hit(b, [0], 'crash', 0.6);
    } else if (style === 'lofi') {
      chordT.inst = 'epiano'; v.forEach((p) => add(chordT, bt, 7, p, 0.55)); v.forEach((p) => add(chordT, bt + 10, 5, p, 0.45));
      bassT.inst = 'bass'; add(bassT, bt, 6, root, 0.8); add(bassT, bt + 7, 3, root + 7, 0.65); add(bassT, bt + 10, 6, root, 0.75);
      hit(b, [0, 7, 10], 'kick', 0.75); hit(b, [4, 12], 'rim', 0.7); hit(b, [0, 3, 4, 7, 8, 11, 12, 15], 'hat', 0.35);
    } else if (style === 'synthwave') {
      chordT.inst = 'pad'; v.forEach((p) => add(chordT, bt, 16, p, 0.45));
      extra.arp = extra.arp || { name: ['琶音', 'Arpeggio'], type: 'inst', inst: 'square', vol: 0.35, notes: [] }; for (let s = 0; s < 16; s++) add(extra.arp, bt + s, 1, v[s % v.length] + 12 * (s % 8 < 4 ? 1 : 0), 0.45);
      bassT.inst = 'synthbass'; for (let s = 0; s < 16; s += 2) add(bassT, bt + s, 2, root + (s === 14 ? 12 : 0), 0.85);
      hit(b, [0, 8], 'kick'); hit(b, [4, 12], 'snare'); hit(b, [0, 2, 4, 6, 8, 10, 12, 14], 'hat', 0.45); if (b % 4 === 3) hit(b, [12, 14], 'tomhi', 0.6);
    } else if (style === 'rock') {
      chordT.inst = 'overdrive'; for (let s = 0; s < 16; s += 2) [c.root + 48, c.root + 55, c.root + 60].forEach((p) => add(chordT, bt + s, 2, p, 0.6));
      bassT.inst = 'bass'; for (let s = 0; s < 16; s += 2) add(bassT, bt + s, 2, root, 0.85);
      hit(b, [0, 6, 8, 10], 'kick'); hit(b, [4, 12], 'snare'); hit(b, [0, 2, 4, 6, 8, 10, 12, 14], 'hat', 0.6); if (b % 4 === 0) hit(b, [0], 'crash', 0.7); if (b % 4 === 3) hit(b, [12, 13, 14, 15], 'tomlo', 0.7);
    }
  });
  return [chordT, bassT, drumT, ...Object.values(extra)];
}

// ------------------------------------------------------------------ the AI melody: a tune that fits the chords and the lyrics
// every lyric line becomes a phrase of two bars; the rhythm fits the number of syllables; notes walk through the scale,
// lean on chord tones, rise and fall like a phrase, and the last line comes home to the key note
const RHYTHMS = {
  4: [[4, 4, 8, 16]], 5: [[2, 2, 4, 8, 16], [4, 4, 4, 4, 16]], 6: [[2, 2, 2, 2, 8, 16], [4, 2, 2, 4, 4, 16]], 7: [[2, 2, 2, 2, 4, 4, 16], [2, 2, 4, 2, 2, 4, 16]],
  8: [[2, 2, 2, 2, 4, 4, 4, 12], [2, 2, 2, 2, 2, 2, 4, 16]], 9: [[2, 2, 2, 2, 2, 2, 4, 4, 12]], 10: [[2, 2, 2, 2, 2, 2, 2, 2, 4, 12]], 11: [[2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 12]], 12: [[2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]],
};
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
export function composeMelody(lines, chords, key, scale, seed = Date.now()) {
  const r = rnd(seed), out = [], sc = SCALES[scale], tonic = PC[key] + 60, pool = [];
  // a comfortable singing range, around the fifth above the key note
  for (let m = tonic - 1; m <= tonic + 16; m++) if (inScale(m, key, scale)) pool.push(m);
  let prev = tonic + sc[4];
  lines.forEach((count, li) => {
    if (!count) return;
    const n = Math.min(12, Math.max(4, count)), opts = RHYTHMS[n], rh = opts[Math.floor(r() * opts.length)].slice();
    // longer lines than our rhythms: split the long note; shorter: the phrase starts later
    while (rh.length < count && rh.some((d) => d >= 4)) { const i = rh.findIndex((d) => d >= 4); const h = rh[i] / 2; rh.splice(i, 1, h, h); }
    const tot = rh.reduce((a, b) => a + b, 0), start = li * 2 * SPB + Math.max(0, 32 - tot);
    const peak = Math.floor(rh.length * (0.3 + r() * 0.4)); let t = start;
    rh.slice(0, count).forEach((d, i) => {
      const bar = Math.floor(t / SPB), c = chord(chords[bar % chords.length]), tones = c ? c.iv.map((iv) => (c.root + iv) % 12) : [];
      const last = i === Math.min(count, rh.length) - 1, strong = t % 8 === 0 || d >= 4;
      let target = prev + (i < peak ? 1 : -1) * (r() < 0.65 ? 1 : 2) * (r() < 0.15 ? -1 : 1);
      let cand = pool.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target)).slice(0, 4);
      if (strong || last) { const ct = cand.filter((m) => tones.includes(m % 12)); if (ct.length) cand = ct; }
      if (last && li === lines.length - 1) cand = pool.filter((m) => (m - PC[key]) % 12 === 0).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
      let p = cand[0]; if (Math.abs(p - prev) > 7) p = cand.find((m) => Math.abs(m - prev) <= 7) || p;
      out.push({ t, d, p, v: strong ? 0.9 : 0.8 }); prev = p; t += d;
    });
  });
  return out;
}

// ------------------------------------------------------------------ sample songs
// a melody written as "E4:2 D4:2 r:4" (pitch:sixteenths), lyrics as text
const mel = (s) => { const out = []; let t = 0; for (const tok of s.trim().split(/\s+/)) { const [p, d] = tok.split(':'); const dd = +(d || 4); if (p !== 'r') out.push({ t, d: dd, p: nm(p), v: 0.85 }); t += dd; } return out; };
function song(o) {
  const chords = o.chords, acc = accompany(o.style, chords), bars = chords.length;
  const tracks = [{ name: ['主唱', 'Lead vocal'], type: 'vocal', voice: o.voice || 'girl', notes: mel(o.melody), lyrics: o.lyrics, vol: 0.9 }, ...acc.map((t) => ({ vol: 0.7, ...t, auto: true }))];
  if (o.lead) tracks.splice(1, 0, { name: ['主旋律樂器', 'Melody'], type: 'inst', inst: o.lead, doubles: o.leadOct || 0, notes: mel(o.melody).map((n) => ({ ...n, p: n.p + (o.leadOct || 0) })), vol: 0.35 });
  return { title: o.title, bpm: o.bpm, key: o.key, scale: o.scale || 'major', bars, chords, style: o.style, tracks, sample: o.id, about: o.about };
}
export const SAMPLES = [
  { id: 'sunny', title: ['晴天的約定', 'Sunny Promise'], about: ['原創 · 流行四和弦', 'Original · four-chord pop'], make: () => song({ id: 'sunny', title: '晴天的約定', bpm: 96, key: 'C', style: 'pop', voice: 'girl',
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
    melody: 'E4:2 E4:2 D4:2 E4:2 G4:4 G4:4 A4:4 G4:12 C5:2 C5:2 B4:2 A4:2 A4:4 G4:4 F4:4 E4:12 E4:2 G4:2 A4:2 G4:2 E4:4 D4:4 D4:4 G4:12 F4:2 F4:2 E4:2 D4:2 C4:4 D4:4 E4:4 C4:12',
    lyrics: '陽光灑在我的窗前 你的笑容比糖還甜 我們說好就在明天 一起奔向藍色海邊' }) },
  { id: 'drive', title: ['Midnight Drive', 'Midnight Drive'], about: ['原創 · 復古電子', 'Original · synthwave'], make: () => song({ id: 'drive', title: 'Midnight Drive', bpm: 108, key: 'C', scale: 'major', style: 'synthwave', voice: 'boy', lead: 'lead', leadOct: 0,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    melody: 'A4:2 A4:2 C5:2 A4:2 G4:4 E4:4 F4:16 G4:2 G4:2 A4:2 G4:2 E4:4 D4:4 G4:16 A4:2 C5:2 D5:2 C5:2 A4:4 G4:4 A4:16 E5:2 D5:2 C5:2 C5:2 D5:4 C5:4 B4:16',
    lyrics: 'Dri-ving through the cit-y lights, ra-di-o is on we fly, ev-ery heart-beat feels so right, hold on ne-ver say good-bye' }) },
  { id: 'cafe', title: ['下雨的咖啡館', 'Rainy Café'], about: ['原創 · Lo-fi 爵士和弦', 'Original · lo-fi jazz chords'], make: () => song({ id: 'cafe', title: '下雨的咖啡館', bpm: 78, key: 'C', style: 'lofi', voice: 'girl',
    chords: ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Am7'],
    melody: 'r:4 F4:2 A4:2 C5:4 A4:4 B4:4 G4:12 r:4 E4:2 G4:2 B4:4 A4:4 G4:4 E4:12 r:4 D4:2 F4:2 A4:4 C5:4 B4:4 D5:12 r:4 C5:2 B4:2 G4:4 E4:4 D4:4 C4:12',
    lyrics: '窗外下著小雨 咖啡還在冒煙 慢慢翻著書頁 想起你的笑臉' }) },
  { id: 'dance', title: ['Dance Floor Lights', 'Dance Floor Lights'], about: ['原創 · 舞曲', 'Original · dance pop'], make: () => song({ id: 'dance', title: 'Dance Floor Lights', bpm: 124, key: 'G', style: 'dance', voice: 'girl',
    chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'],
    melody: 'B4:2 B4:2 A4:2 G4:2 E4:4 G4:4 E4:16 D5:2 D5:2 B4:2 A4:2 B4:4 A4:4 F#4:16 B4:2 D5:2 E5:2 D5:2 B4:4 A4:4 G4:16 G4:2 A4:2 B4:2 D5:2 E5:4 D5:4 D5:16',
    lyrics: 'Move your bo-dy to the beat, lights are flash-ing feel the heat, ev-ery night we come a-live, dan-cing till the mor-ning light' }) },
  { id: 'star', title: ['小星星', 'Little Star (中文)'], about: ['兒歌 · 公共領域', 'Nursery song · public domain'], make: () => song({ id: 'star', title: '小星星', bpm: 96, key: 'C', style: 'ballad', voice: 'kid', lead: 'musicbox', leadOct: 12,
    chords: ['C', 'C', 'F', 'C', 'F', 'C', 'G', 'C', 'C', 'F', 'C', 'G', 'C', 'F', 'C', 'G', 'C', 'C', 'F', 'C', 'F', 'C', 'G', 'C'].filter((_, i) => i % 2 === 0),
    melody: 'C4 C4 G4 G4 A4 A4 G4:8 F4 F4 E4 E4 D4 D4 C4:8 G4 G4 F4 F4 E4 E4 D4:8 G4 G4 F4 F4 E4 E4 D4:8 C4 C4 G4 G4 A4 A4 G4:8 F4 F4 E4 E4 D4 D4 C4:8',
    lyrics: '一閃一閃亮晶晶 滿天都是小星星 掛在天上放光明 好像許多小眼睛 一閃一閃亮晶晶 滿天都是小星星' }) },
  { id: 'twinkle', title: ['Twinkle Twinkle', 'Twinkle Twinkle'], about: ['兒歌 · 公共領域', 'Nursery song · public domain'], make: () => song({ id: 'twinkle', title: 'Twinkle Twinkle Little Star', bpm: 96, key: 'C', style: 'ballad', voice: 'kid', lead: 'musicbox', leadOct: 12,
    chords: ['C', 'F', 'C', 'G', 'C', 'G', 'C', 'G', 'C', 'F', 'C', 'G'],
    melody: 'C4 C4 G4 G4 A4 A4 G4:8 F4 F4 E4 E4 D4 D4 C4:8 G4 G4 F4 F4 E4 E4 D4:8 G4 G4 F4 F4 E4 E4 D4:8 C4 C4 G4 G4 A4 A4 G4:8 F4 F4 E4 E4 D4 D4 C4:8',
    lyrics: 'Twin-kle twin-kle lit-tle star, how I won-der what you are, up a-bove the world so high, like a dia-mond in the sky, twin-kle twin-kle lit-tle star, how I won-der what you are' }) },
  { id: 'tigers', title: ['兩隻老虎', 'Two Tigers'], about: ['民謠 · 公共領域', 'Folk tune · public domain'], make: () => song({ id: 'tigers', title: '兩隻老虎', bpm: 120, key: 'C', style: 'pop', voice: 'kid',
    chords: ['C', 'C', 'C', 'C', 'C', 'C', 'G', 'C'],
    melody: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:8 E4 F4 G4:8 G4:2 A4:2 G4:2 F4:2 E4 C4 G4:2 A4:2 G4:2 F4:2 E4 C4 C4 G3 C4:8 C4 G3 C4:8',
    lyrics: '兩隻老虎 兩隻老虎 跑得快 跑得快 一隻沒有耳朵 一隻沒有尾巴 真奇怪 真奇怪' }) },
];
export function blankSong(lang) {
  const chords = progression('pop', 'C', 8);
  return { title: lang === 'zh' ? '我的第一首歌' : 'My First Song', bpm: 100, key: 'C', scale: 'major', bars: 8, chords, style: 'pop',
    tracks: [{ name: ['主唱', 'Lead vocal'], type: 'vocal', voice: 'girl', notes: [], lyrics: '', vol: 0.9 }, { name: ['鋼琴', 'Piano'], type: 'inst', inst: 'piano', notes: [], vol: 0.7 }, { name: ['鼓', 'Drums'], type: 'drums', inst: 'drums', notes: [], vol: 0.7 }] };
}
