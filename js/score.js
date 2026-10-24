// Sheet music for a track, drawn with VexFlow: a grand staff for an instrument or a voice (treble above middle C, bass
// below), in the song's key, four bars to a line, with chords, rests and ties; a percussion staff for drums.
import { SPB, DRUMS } from './sound.js?v=1';

let VF = null;
async function vexflow() {
  if (VF) return VF;
  await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  VF = window.Vex.Flow; return VF;
}
// lengths in sixteenths, as note values (longest first); anything else is split and tied
const DUR = [[16, 'w'], [12, 'hd'], [8, 'h'], [6, 'qd'], [4, 'q'], [3, '8d'], [2, '8'], [1, '16']];
function pieces(len, at) {
  const out = [];
  while (len > 0) {
    // keep a note from running across the middle of the bar or a beat when it does not start on one
    let room = len; const inBar = at % SPB;
    if (inBar % 4) room = Math.min(room, 4 - (inBar % 4));
    const d = DUR.find(([n]) => n <= room) || DUR[DUR.length - 1];
    out.push(d); len -= d[0]; at += d[0];
  }
  return out;
}
const FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
const SHARP_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'], FLAT_NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];
function keySpec(key, scale) {
  if (scale !== 'minor') return { C: 'C', 'C#': 'Db', D: 'D', Eb: 'Eb', E: 'E', F: 'F', 'F#': 'F#', G: 'G', Ab: 'Ab', A: 'A', Bb: 'Bb', B: 'B' }[key] || 'C';
  return { C: 'Cm', 'C#': 'C#m', D: 'Dm', Eb: 'Ebm', E: 'Em', F: 'Fm', 'F#': 'F#m', G: 'Gm', Ab: 'G#m', A: 'Am', Bb: 'Bbm', B: 'Bm' }[key] || 'Am';
}
// where each drum sits on a percussion staff, and its note head
const DRUM_KEY = { kick: 'f/4', snare: 'c/5', clap: 'c/5/x2', hat: 'g/5/x2', open: 'g/5/x3', tomlo: 'a/4', tomhi: 'e/5', crash: 'a/5/x2', rim: 'c/5/x3', shaker: 'f/5/x2' };

export async function drawScore(el, song, tr, lang = 'zh') {
  const V = await vexflow(), drums = tr.type === 'drums', bars = song.bars;
  const ks = keySpec(song.key, song.scale), flats = FLAT_KEYS.includes(ks.replace('m', '')) || /^(Dm|Gm|Cm|Fm|Bbm|Ebm)$/.test(ks);
  const name = (p) => `${(flats ? FLAT_NAMES : SHARP_NAMES)[p % 12]}/${Math.floor(p / 12) - 1}`;
  const perLine = Math.max(1, Math.min(4, Math.floor((el.clientWidth || 900) / 230))), lines = Math.ceil(bars / perLine);
  const W = Math.max(el.clientWidth || 900, 700), barW = (W - 30) / perLine, lineH = drums ? 120 : 230;
  el.innerHTML = '';
  const r = new V.Renderer(el, V.Renderer.Backends.SVG); r.resize(W, lines * lineH + 40);
  const c = r.getContext(); c.setFont('Arial', 10);
  // the notes of one staff in one bar: chords grouped by start, gaps filled with rests, long notes tied
  const barNotes = (list, bar, clef) => {
    const b0 = bar * SPB, b1 = b0 + SPB, starts = new Map();
    for (const n of list) { if (n.t < b0 || n.t >= b1) continue; const k = n.t; if (!starts.has(k)) starts.set(k, []); starts.get(k).push(n); }
    const ts = [...starts.keys()].sort((a, b) => a - b), out = [], ties = [];
    let at = b0;
    const rest = (len) => { for (const [, d] of pieces(len, at)) { out.push(new V.StaveNote({ keys: [drums ? 'c/5' : clef === 'bass' ? 'd/3' : 'b/4'], duration: d + 'r', clef: drums ? 'percussion' : clef })); at += DUR.find(([, x]) => x === d)[0]; } };
    ts.forEach((t, i) => {
      if (t > at) rest(t - at);
      const grp = starts.get(t), next = i + 1 < ts.length ? ts[i + 1] : b1;
      const len = Math.max(1, Math.min(next, b1, t + (drums ? 16 : Math.min(...grp.map((n) => n.d)))) - t);
      const keys = drums ? [...new Set(grp.map((n) => DRUM_KEY[(DRUMS[n.p] || {}).id] || 'c/5'))] : [...new Set(grp.map((n) => n.p))].sort((a, b) => a - b).map(name);
      const segs = pieces(drums ? Math.min(len, next - t) : len, t); let prev = null;
      segs.forEach(([, d]) => {
        const sn = new V.StaveNote({ keys, duration: d, clef: drums ? 'percussion' : clef, stem_direction: drums ? 1 : undefined, auto_stem: !drums });
        if (d.endsWith('d')) V.Dot.buildAndAttach([sn], { all: true });
        out.push(sn); if (prev && !drums) ties.push([prev, sn]); prev = sn;
      });
      at = t + segs.reduce((s, [, d]) => s + DUR.find(([, x]) => x === d)[0], 0);
    });
    if (at < b1) rest(b1 - at);
    return { out, ties };
  };
  const hi = drums ? tr.notes : tr.notes.filter((n) => n.p >= 60), lo = drums ? [] : tr.notes.filter((n) => n.p < 60);
  for (let bar = 0; bar < bars; bar++) {
    const line = Math.floor(bar / perLine), col = bar % perLine, x = 15 + col * barW, y = 20 + line * lineH, first = col === 0;
    const staves = [];
    const top = new V.Stave(x, y, barW); if (first) { top.addClef(drums ? 'percussion' : 'treble'); if (!drums) top.addKeySignature(ks); } if (bar === 0) top.addTimeSignature('4/4');
    if (first) top.setText(String(bar + 1), V.Modifier.Position.ABOVE, { shift_x: -barW / 2 + 12, shift_y: 0 });
    top.setContext(c).draw(); staves.push([top, hi, drums ? 'percussion' : 'treble']);
    if (!drums) {
      const bot = new V.Stave(x, y + 100, barW); if (first) { bot.addClef('bass').addKeySignature(ks); } if (bar === 0) bot.addTimeSignature('4/4'); bot.setContext(c).draw(); staves.push([bot, lo, 'bass']);
      if (first) { new V.StaveConnector(top, bot).setType(V.StaveConnector.type.BRACE).setContext(c).draw(); new V.StaveConnector(top, bot).setType(V.StaveConnector.type.SINGLE_LEFT).setContext(c).draw(); }
      new V.StaveConnector(top, bot).setType(V.StaveConnector.type.SINGLE_RIGHT).setContext(c).draw();
    }
    for (const [st, list, clef] of staves) {
      const { out, ties } = barNotes(list, bar, clef);
      const voice = new V.Voice({ num_beats: 4, beat_value: 4 }).setMode(V.Voice.Mode.SOFT).addTickables(out);
      if (!drums) V.Accidental.applyAccidentals([voice], ks);
      const beams = V.Beam.generateBeams(out.filter((n) => !n.isRest()), { groups: [new V.Fraction(1, 4)] });
      new V.Formatter().joinVoices([voice]).format([voice], barW - (st.getNoteStartX() - x) - 12);
      voice.draw(c, st); beams.forEach((b) => b.setContext(c).draw());
      ties.forEach(([a, b]) => new V.StaveTie({ first_note: a, last_note: b, first_indices: a.keys.map((_, i) => i), last_indices: b.keys.map((_, i) => i) }).setContext(c).draw());
    }
  }
  return el.querySelector('svg');
}
