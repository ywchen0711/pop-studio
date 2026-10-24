// Pop Studio: be a pop producer. Tracks of real instruments and drums, a piano roll to write the music, chords and
// one-click accompaniment, lyrics that the AI singer sings (and an AI melody that fits them), sample songs, WAV export.
import { INSTRUMENTS, DRUMS, SPB, audio, ensure, loadInstrument, play, stop, player, position, renderWav, preview } from './sound.js?v=1';
import { VOICES, syllables, splitText } from './voice.js?v=1';
import { KEYS, SCALES, PROG_NAMES, STYLES, progression, accompany, composeMelody, SAMPLES, blankSong, noteName, inScale, chord } from './music.js?v=1';
import { record, humToNotes, beatToHits } from './listen.js?v=1';
import { drawScore } from './score.js?v=1';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const KEY = 'popstudio.v1', GAME = 'pop-studio';
let S = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } })() || {};
S = Object.assign({ lang: /^zh/i.test(navigator.language || '') ? 'zh' : 'en', songs: [], current: null }, S);
let cloud = null, saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { S.current = strip(song); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* full */ } if (cloud) cloud.touch(GAME, KEY); }, 400); }
const strip = (s) => { const c = clone(s); for (const t of c.tracks) for (const n of t.notes) delete n.syl; return c; };
const COLORS = ['#ff5ea8', '#5ec8ff', '#ffd04a', '#7ce38b', '#b48cff', '#ff9a4a', '#4ae0c8', '#ff6a6a'];

const TX = {
  zh: { app: '流行歌製作人', play: '播放', stop: '停止', loop: '循環', bpm: 'BPM', key: '調', bars: '小節', samples: '範例歌曲', mine: '我的歌', wav: '匯出 WAV', share: '分享', newSong: '新歌', save: '儲存', tracks: '音軌', addInst: '樂器', addDrums: '鼓組', addVocal: '人聲',
    auto: '🎼 自動伴奏', ai: '🤖 AI 依歌詞作曲', apply: '套用歌詞', lyrics: '歌詞', lyricsPh: '一行一句歌詞。中文一個字唱一個音；英文可以用連字號分音節，例如 twin-kle。用 ~ 讓上一個字拉長。', voice: '歌手', inst: '樂器', len: '音符長度', draw: '✏️ 畫', erase: '🧹 擦', chords: '和弦', style: '曲風', prog: '和弦進行', keep: '保留目前的和弦', make: '產生伴奏', cancel: '取消',
    loading: '正在載入樂器音色…', rendering: '正在混音輸出…', copied: '分享連結已複製！', saved: '已儲存', del: '刪除', open: '打開', sylInfo: (a, b) => `歌詞 ${a} 個字 · 旋律 ${b} 個音`, noteSyl: '這個音唱的字', mute: '靜音', solo: '獨奏', vol: '音量', scale: { major: '大調', minor: '小調' },
    hint: '在格子上點一下加音符，拖曳移動，拉右邊改長短，右鍵或雙擊刪除。', drumHint: '點格子加鼓聲，再點一次拿掉。', emptyMine: '還沒有儲存的歌', aboutSamples: '原創的流行風格歌曲，和大家都能用的兒歌民謠。（現在的流行金曲有版權，所以不能放進來）', name: '名稱', confirmNew: '確定開新歌？目前的歌會先自動儲存。', title: '歌名', aiNeedLyrics: '先在歌詞框寫幾句歌詞', bars2: (n) => `${n} 小節`,
    hum: '🎙️ 哼唱', beat: '🎙️ 用嘴打鼓', score: '🎼 樂譜', addHum: '哼一段', humT: '🎙️ 哼一段旋律', beatT: '🎙️ 用嘴打鼓',
    humInfo: '倒數四拍後開始錄。用「嗒、嗒」或「啦」哼，一個音一個音清楚地唱，會變成鋼琴譜。戴耳機效果最好。',
    beatInfo: '倒數四拍後開始錄。「動」= 大鼓、「恰／嗆」= 小鼓、「次」= 鈸、「次～」拉長 = 開放鈸。會變成鼓譜。',
    recBars: '錄幾小節', fromBar: '從第幾小節', into: '放到', newPiano: '新的鋼琴音軌', thisTrack: '目前這個音軌', newDrums: '新的鼓組', snapKey: '對齊調性', clickOn: '錄音時打拍子（請戴耳機）',
    recStart: '● 開始錄音', recStop: '■ 停止', counting: '準備…', recording: '錄音中', listening: '正在聽寫…', heard: (n, b) => b ? `聽到 ${n} 下鼓聲` : `聽到 ${n} 個音`, heardNone: '沒聽到聲音，再試一次（靠近麥克風，大聲一點）',
    tryIt: '▶ 聽聽看', retake: '↺ 重錄', done: '完成', noMic: '沒辦法使用麥克風。請允許瀏覽器使用麥克風（需要 https）。', humName: '哼的旋律', scoreT: '樂譜', dlSvg: '⬇️ 下載樂譜', print: '🖨️ 列印', scoreFail: '樂譜載入失敗（需要網路）' },
  en: { app: 'Pop Studio', play: 'Play', stop: 'Stop', loop: 'Loop', bpm: 'BPM', key: 'Key', bars: 'Bars', samples: 'Sample songs', mine: 'My songs', wav: 'Export WAV', share: 'Share', newSong: 'New song', save: 'Save', tracks: 'Tracks', addInst: 'Instrument', addDrums: 'Drums', addVocal: 'Vocal',
    auto: '🎼 Auto band', ai: '🤖 AI melody from lyrics', apply: 'Apply lyrics', lyrics: 'Lyrics', lyricsPh: 'One line per phrase. In Chinese each character is one note; in English split syllables with hyphens, like twin-kle. Use ~ to hold the previous syllable.', voice: 'Singer', inst: 'Instrument', len: 'Note length', draw: '✏️ Draw', erase: '🧹 Erase', chords: 'Chords', style: 'Style', prog: 'Progression', keep: 'Keep my chords', make: 'Make the band', cancel: 'Cancel',
    loading: 'Loading instrument sounds…', rendering: 'Mixing down…', copied: 'Share link copied!', saved: 'Saved', del: 'Delete', open: 'Open', sylInfo: (a, b) => `${a} syllables · ${b} notes`, noteSyl: 'Syllable on this note', mute: 'Mute', solo: 'Solo', vol: 'Volume', scale: { major: 'major', minor: 'minor' },
    hint: 'Click the grid to add a note, drag to move, drag its right edge to resize, right-click or double-click to delete.', drumHint: 'Click a cell to add a hit, again to remove it.', emptyMine: 'No saved songs yet', aboutSamples: 'Original pop-style songs, and nursery songs and folk tunes everyone may use. (Today’s pop hits are copyrighted, so they can’t be included.)', name: 'Name', confirmNew: 'Start a new song? The current one is saved first.', title: 'Song title', aiNeedLyrics: 'Write a few lines of lyrics first', bars2: (n) => `${n} bars`,
    hum: '🎙️ Hum', beat: '🎙️ Beatbox', score: '🎼 Score', addHum: 'Hum a tune', humT: '🎙️ Hum a melody', beatT: '🎙️ Beatbox a beat',
    humInfo: 'Recording starts after a four-beat count-in. Hum on “da da” or “la”, each note clearly, and it becomes piano notes. Headphones work best.',
    beatInfo: 'Recording starts after a four-beat count-in. “Boom” = kick, “ka / pah” = snare, “ts” = hi-hat, a long “tsss” = open hat. It becomes a drum part.',
    recBars: 'Bars to record', fromBar: 'Start at bar', into: 'Put it in', newPiano: 'A new piano track', thisTrack: 'This track', newDrums: 'A new drum track', snapKey: 'Snap to the key', clickOn: 'Metronome while recording (use headphones)',
    recStart: '● Record', recStop: '■ Stop', counting: 'Get ready…', recording: 'Recording', listening: 'Writing it down…', heard: (n, b) => b ? `Heard ${n} drum hits` : `Heard ${n} notes`, heardNone: 'Didn’t hear anything; try again (closer to the microphone, a bit louder)',
    tryIt: '▶ Listen', retake: '↺ Retake', done: 'Done', noMic: 'Can’t use the microphone. Allow the browser to use it (it needs https).', humName: 'Hummed tune', scoreT: 'Score', dlSvg: '⬇️ Download score', print: '🖨️ Print', scoreFail: 'Could not load the score (it needs the internet)' },
};
const t = () => TX[S.lang];
const tx = (a) => (Array.isArray(a) ? a[S.lang === 'zh' ? 0 : 1] : a);

// ------------------------------------------------------------------ the song being worked on
let song = S.current ? S.current : SAMPLES[0].make();
let sel = 0, noteLen = 4, tool = 'draw', selNote = null, playFrom = 0;
const CW = 22, RH = 15;
const trackColor = (i) => COLORS[i % COLORS.length];
const rowsOf = (tr) => (tr.type === 'drums' ? DRUMS.map((_, i) => i).reverse() : Array.from({ length: 49 }, (_, i) => 84 - i));   // C3..C7 top down

// lyrics -> syllables on the notes of a vocal track
async function assignLyrics(tr) {
  const sy = await syllables(tr.lyrics || ''), notes = tr.notes.slice().sort((a, b) => a.t - b.t);
  notes.forEach((n, i) => { const s = sy[i]; n.hold = !!(s && s.hold); n.syl = s && !s.hold ? { text: s.text, c: s.c, v: s.v, coda: s.coda } : n.syl && n.syl.manual ? n.syl : { text: 'la', c: 'l', v: ['a'], coda: '' }; });
}
async function assignAll() { for (const tr of song.tracks) if (tr.type === 'vocal') await assignLyrics(tr); }

// ------------------------------------------------------------------ layout
function render() {
  const L = t();
  document.documentElement.lang = S.lang === 'zh' ? 'zh-Hant' : 'en';
  $('app').innerHTML = `<header class="top">
      <span class="logo">🎤 <b>${L.app}</b></span>
      <input id="title" class="title" value="${esc(song.title)}" aria-label="${L.title}">
      <div class="transport"><button id="bPlay" class="tp play">▶</button><button id="bStop" class="tp">■</button><button id="bLoop" class="tp ${S.loop ? 'on' : ''}" title="${L.loop}">🔁</button></div>
      <label class="fld">${L.bpm}<input id="bpm" type="number" min="50" max="200" value="${song.bpm}"></label>
      <label class="fld">${L.key}<select id="key">${KEYS.map((k) => `<option ${k === song.key ? 'selected' : ''}>${k}</option>`).join('')}</select><select id="scale">${Object.keys(SCALES).map((k) => `<option value="${k}" ${k === song.scale ? 'selected' : ''}>${L.scale[k]}</option>`).join('')}</select></label>
      <label class="fld">${L.bars}<select id="bars">${[4, 8, 12, 16, 24, 32].map((n) => `<option ${n === song.bars ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <span class="sp"></span>
      <button class="btn" id="bSamples">📀 ${L.samples}</button><button class="btn" id="bMine">💾 ${L.mine}</button><button class="btn" id="bNew">✨ ${L.newSong}</button><button class="btn" id="bWav">⬇️ ${L.wav}</button><button class="btn" id="bShare">🔗 ${L.share}</button><button class="btn" id="bLang">${S.lang === 'zh' ? 'EN' : '中文'}</button>
    </header>
    <div class="main"><aside id="tracks"></aside><section class="editor"><div id="tools" class="tools"></div><div id="roll" class="roll"></div><div id="lyr"></div></section></div>
    <div id="status" class="status" hidden></div>`;
  wireTop(); renderTracks(); renderEditor();
}
function wireTop() {
  const L = t();
  $('title').oninput = () => { song.title = $('title').value; save(); };
  $('bPlay').onclick = () => (player.playing ? stopPlay() : startPlay());
  $('bStop').onclick = () => { stopPlay(); playFrom = 0; drawHead(0); };
  $('bLoop').onclick = () => { S.loop = !S.loop; $('bLoop').classList.toggle('on', S.loop); save(); };
  $('bpm').onchange = () => { song.bpm = Math.max(50, Math.min(200, +$('bpm').value || 100)); save(); };
  $('key').onchange = () => { song.key = $('key').value; save(); renderEditor(); };
  $('scale').onchange = () => { song.scale = $('scale').value; save(); renderEditor(); };
  $('bars').onchange = () => { setBars(+$('bars').value); };
  $('bSamples').onclick = () => samplesDialog();
  $('bMine').onclick = () => mineDialog();
  $('bNew').onclick = () => { saveToMine(true); song = blankSong(S.lang); sel = 0; save(); render(); };
  $('bWav').onclick = () => exportWav();
  $('bShare').onclick = () => share();
  $('bLang').onclick = () => { S.lang = S.lang === 'zh' ? 'en' : 'zh'; save(); render(); };
}
function setBars(n) {
  song.bars = n;
  const ch = song.chords || []; song.chords = Array.from({ length: n }, (_, i) => ch[i] || ch[i % Math.max(1, ch.length)] || 'C');
  for (const tr of song.tracks) tr.notes = tr.notes.filter((x) => x.t < n * SPB);
  save(); renderEditor();
}

// ------------------------------------------------------------------ tracks and the mixer
function renderTracks() {
  const L = t();
  $('tracks').innerHTML = `<h3>${L.tracks}</h3>${song.tracks.map((tr, i) => `<div class="trk ${i === sel ? 'sel' : ''}" data-i="${i}" style="--c:${trackColor(i)}">
      <div class="th"><span class="ti">${tr.type === 'vocal' ? '🎤' : tr.type === 'drums' ? '🥁' : (INSTRUMENTS[tr.inst] || INSTRUMENTS.piano).icon}</span><b>${esc(tx(tr.name))}</b><small>${tr.type === 'vocal' ? tx(VOICES[tr.voice || 'girl'].n) : tr.type === 'drums' ? '' : tx((INSTRUMENTS[tr.inst] || INSTRUMENTS.piano).n)}</small></div>
      <div class="tc"><button data-m="${i}" class="${tr.mute ? 'on' : ''}" title="${L.mute}">M</button><button data-s="${i}" class="${tr.solo ? 'on' : ''}" title="${L.solo}">S</button><input type="range" data-v="${i}" min="0" max="1" step="0.05" value="${tr.vol ?? 0.8}" title="${L.vol}"><button data-x="${i}" title="${L.del}">✕</button></div>
      <div class="mini">${miniNotes(tr, i)}</div></div>`).join('')}
    <div class="adds"><button id="aInst">＋🎹 ${L.addInst}</button><button id="aDrums">＋🥁 ${L.addDrums}</button><button id="aVocal">＋🎤 ${L.addVocal}</button><button id="aHum">＋🎙️ ${L.addHum}</button></div>
    <button class="big" id="bAuto">${L.auto}</button>`;
  $('tracks').querySelectorAll('.trk').forEach((el) => el.onclick = (e) => { if (e.target.closest('button,input')) return; sel = +el.dataset.i; selNote = null; renderTracks(); renderEditor(); });
  $('tracks').querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { const tr = song.tracks[+b.dataset.m]; tr.mute = !tr.mute; save(); renderTracks(); });
  $('tracks').querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { const tr = song.tracks[+b.dataset.s]; tr.solo = !tr.solo; save(); renderTracks(); });
  $('tracks').querySelectorAll('[data-v]').forEach((r) => r.oninput = () => { song.tracks[+r.dataset.v].vol = +r.value; save(); });
  $('tracks').querySelectorAll('[data-x]').forEach((b) => b.onclick = () => { if (song.tracks.length <= 1) return; song.tracks.splice(+b.dataset.x, 1); sel = Math.min(sel, song.tracks.length - 1); save(); renderTracks(); renderEditor(); });
  $('aInst').onclick = () => addTrack({ name: [INSTRUMENTS.piano.n[0], INSTRUMENTS.piano.n[1]], type: 'inst', inst: 'piano', notes: [], vol: 0.7 });
  $('aDrums').onclick = () => addTrack({ name: ['鼓', 'Drums'], type: 'drums', inst: 'drums', notes: [], vol: 0.7 });
  $('aVocal').onclick = () => addTrack({ name: ['合音', 'Backing vocal'], type: 'vocal', voice: 'choir', notes: [], lyrics: '', vol: 0.6 });
  $('bAuto').onclick = () => autoDialog();
  $('aHum').onclick = () => micDialog('hum', null);
}
function miniNotes(tr, i) {
  const total = song.bars * SPB, lo = tr.type === 'drums' ? 0 : Math.min(...tr.notes.map((n) => n.p), 60), hi = tr.type === 'drums' ? 9 : Math.max(...tr.notes.map((n) => n.p), 72), span = Math.max(1, hi - lo);
  return `<svg viewBox="0 0 200 24" preserveAspectRatio="none">${tr.notes.slice(0, 600).map((n) => `<rect x="${(n.t / total) * 200}" y="${22 - ((n.p - lo) / span) * 20}" width="${Math.max(1, (n.d / total) * 200)}" height="2" fill="${trackColor(i)}"/>`).join('')}</svg>`;
}
function addTrack(tr) { song.tracks.push(tr); sel = song.tracks.length - 1; save(); renderTracks(); renderEditor(); }

// ------------------------------------------------------------------ the editor: tools, chord lane, piano roll or drum grid
function renderEditor() {
  const L = t(), tr = song.tracks[sel];
  if (!tr) return;
  const instSel = tr.type === 'vocal' ? `<label>${L.voice}<select id="tInst">${Object.entries(VOICES).map(([k, v]) => `<option value="${k}" ${k === (tr.voice || 'girl') ? 'selected' : ''}>${tx(v.n)}</option>`).join('')}</select></label>`
    : tr.type === 'drums' ? '' : `<label>${L.inst}<select id="tInst">${Object.entries(INSTRUMENTS).map(([k, v]) => `<option value="${k}" ${k === tr.inst ? 'selected' : ''}>${v.icon} ${tx(v.n)}</option>`).join('')}</select></label>`;
  $('tools').innerHTML = `<input class="tname" id="tName" value="${esc(tx(tr.name))}" style="--c:${trackColor(sel)}">${instSel}
    ${tr.type === 'drums' ? '' : `<label>${L.len}<select id="tLen">${[[1, '1/16'], [2, '1/8'], [4, '1/4'], [8, '1/2'], [16, '1']].map(([v, n]) => `<option value="${v}" ${v === noteLen ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
    <span class="seg"><button id="tDraw" class="${tool === 'draw' ? 'on' : ''}">${L.draw}</button><button id="tErase" class="${tool === 'erase' ? 'on' : ''}">${L.erase}</button></span>
    <button class="btn hot" id="tMic">${tr.type === 'drums' ? L.beat : L.hum}</button><button class="btn" id="tScore">${L.score}</button>
    ${tr.type === 'vocal' && selNote ? `<label>${L.noteSyl}<input id="tSyl" class="syl" value="${esc(selNote.syl ? selNote.syl.text : '')}" maxlength="12"></label>` : ''}
    <small class="hint">${tr.type === 'drums' ? L.drumHint : L.hint}</small>`;
  $('tName').oninput = () => { tr.name = [$('tName').value, $('tName').value]; save(); renderTracks(); };
  if ($('tInst')) $('tInst').onchange = () => { if (tr.type === 'vocal') tr.voice = $('tInst').value; else { tr.inst = $('tInst').value; loadInstrument(tr.inst); preview(tr, 60); } save(); renderTracks(); };
  if ($('tLen')) $('tLen').onchange = () => { noteLen = +$('tLen').value; };
  $('tDraw').onclick = () => { tool = 'draw'; renderEditor(); };
  $('tMic').onclick = () => micDialog(tr.type === 'drums' ? 'beat' : 'hum', tr);
  $('tScore').onclick = () => scoreDialog(tr);
  $('tErase').onclick = () => { tool = 'erase'; renderEditor(); };
  if ($('tSyl')) $('tSyl').onchange = async () => { const v = $('tSyl').value.trim(); if (!v) return; const sy = (await syllables(v))[0]; if (sy) { selNote.syl = { text: sy.text, c: sy.c, v: sy.v, coda: sy.coda, manual: true }; save(); drawNotes(); } };
  renderRoll(tr);
  renderLyrics(tr);
}
function renderRoll(tr) {
  const rows = rowsOf(tr), steps = song.bars * SPB, W = steps * CW, H = rows.length * RH;
  const chordLane = `<div class="lane" style="width:${W}px">${(song.chords || []).slice(0, song.bars).map((c, b) => `<button class="chip" data-bar="${b}" style="left:${b * SPB * CW}px;width:${SPB * CW - 4}px">${esc(c)}</button>`).join('')}</div>`;
  const ruler = `<div class="ruler" id="ruler" style="width:${W}px">${Array.from({ length: song.bars }, (_, b) => `<span style="left:${b * SPB * CW}px">${b + 1}</span>`).join('')}</div>`;
  const keys = rows.map((p) => tr.type === 'drums' ? `<div class="key drum">${tx(DRUMS[p].n)}</div>` : `<div class="key ${/#/.test(noteName(p)) ? 'blk' : ''} ${p % 12 === 0 ? 'c' : ''}" data-p="${p}">${p % 12 === 0 || !/#/.test(noteName(p)) && tr.type !== 'drums' ? noteName(p) : ''}</div>`).join('');
  const rowBg = rows.map((p, i) => `<div class="row ${tr.type !== 'drums' && /#/.test(noteName(p)) ? 'blk' : ''} ${tr.type !== 'drums' && !inScale(p, song.key, song.scale) ? 'out' : ''}" style="top:${i * RH}px"></div>`).join('');
  $('roll').innerHTML = `<div class="corner"></div><div class="scrollx" id="sx"><div class="head">${chordLane}${ruler}</div><div class="body"><div class="keys">${keys}</div><div class="grid ${tr.type}" id="grid" style="width:${W}px;height:${H}px;--cw:${CW}px">${rowBg}<div id="notes"></div><div class="playhead" id="ph"></div></div></div></div>`;
  $('roll').querySelectorAll('.chip').forEach((b) => b.onclick = () => chordPicker(+b.dataset.bar));
  $('ruler').onclick = (e) => { const r = $('ruler').getBoundingClientRect(); playFrom = Math.max(0, Math.floor((e.clientX - r.left) / CW / 4) * 4); drawHead(playFrom); if (player.playing) startPlay(); };
  $('roll').querySelectorAll('.key[data-p]').forEach((k) => k.onpointerdown = () => preview(tr, +k.dataset.p, { text: 'la', c: 'l', v: ['a'], coda: '' }));
  drawNotes(); hookGrid(tr, rows);
  // scroll so the notes (or middle C) are in view
  const sx = $('sx');
  if (tr.type !== 'drums') { const ps = tr.notes.map((n) => n.p); const mid = ps.length ? (Math.max(...ps) + Math.min(...ps)) / 2 : 64; sx.scrollTop = Math.max(0, rows.indexOf(Math.round(mid)) * RH - sx.clientHeight / 2 + 60); }
  drawHead(playFrom);
}
function drawNotes() {
  const tr = song.tracks[sel], rows = rowsOf(tr), box = $('notes'); if (!box) return;
  const c = trackColor(sel);
  box.innerHTML = tr.notes.map((n, i) => { const r = rows.indexOf(n.p); if (r < 0) return ''; return `<div class="note ${n === selNote ? 'sel' : ''} ${n.hold ? 'hold' : ''}" data-n="${i}" style="left:${n.t * CW}px;top:${r * RH}px;width:${n.d * CW - 2}px;--c:${c};opacity:${0.5 + (n.v ?? 0.8) * 0.5}">${tr.type === 'vocal' && n.syl ? `<span>${esc(n.hold ? '~' : n.syl.text)}</span>` : ''}<i class="rs"></i></div>`; }).join('');
}
function hookGrid(tr, rows) {
  const grid = $('grid'); let drag = null;
  const at = (e) => { const r = grid.getBoundingClientRect(); return { step: Math.max(0, Math.min(song.bars * SPB - 1, Math.floor((e.clientX - r.left) / CW))), row: Math.max(0, Math.min(rows.length - 1, Math.floor((e.clientY - r.top) / RH))) }; };
  grid.oncontextmenu = (e) => { e.preventDefault(); const el = e.target.closest('.note'); if (el) { tr.notes.splice(+el.dataset.n, 1); afterEdit(tr); } };
  grid.ondblclick = (e) => { const el = e.target.closest('.note'); if (el && tr.type !== 'drums') { tr.notes.splice(+el.dataset.n, 1); afterEdit(tr); } };
  grid.onpointerdown = (e) => {
    if (e.button !== 0) return;
    const p = at(e), el = e.target.closest('.note');
    if (tr.type === 'drums') {
      const ix = tr.notes.findIndex((n) => n.t === p.step && n.p === rows[p.row]);
      if (ix >= 0) tr.notes.splice(ix, 1); else { tr.notes.push({ t: p.step, d: 1, p: rows[p.row], v: 0.9 }); preview(tr, rows[p.row]); }
      afterEdit(tr); return;
    }
    if (el) {
      const n = tr.notes[+el.dataset.n];
      if (tool === 'erase') { tr.notes.splice(+el.dataset.n, 1); afterEdit(tr); return; }
      selNote = n; preview(tr, n.p, n.syl);
      drag = { n, mode: e.target.classList.contains('rs') ? 'size' : 'move', p0: p, t0: n.t, pitch0: n.p, d0: n.d };
    } else {
      if (tool === 'erase') return;
      const snap = Math.min(noteLen, 4), t0 = Math.floor(p.step / snap) * snap, n = { t: t0, d: noteLen, p: rows[p.row], v: 0.85 };
      tr.notes.push(n); selNote = n; preview(tr, n.p, n.syl);
      drag = { n, mode: 'size', p0: { step: t0, row: p.row }, t0, pitch0: n.p, d0: noteLen, fresh: true };
    }
    grid.setPointerCapture(e.pointerId); drawNotes();
  };
  grid.onpointermove = (e) => {
    if (!drag) return; const p = at(e), n = drag.n;
    if (drag.mode === 'move') { n.t = Math.max(0, Math.min(song.bars * SPB - n.d, drag.t0 + p.step - drag.p0.step)); const np = rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(drag.pitch0) + p.row - drag.p0.row))]; if (np !== n.p) { n.p = np; preview(tr, n.p, n.syl); } }
    else n.d = Math.max(1, Math.min(song.bars * SPB - n.t, drag.d0 + (p.step - drag.p0.step) - (drag.fresh ? noteLen - 1 : 0)));
    drawNotes();
  };
  grid.onpointerup = () => { if (drag) { drag = null; afterEdit(tr); } };
}
async function afterEdit(tr) { if (tr.type === 'vocal') await assignLyrics(tr); save(); drawNotes(); renderTracks(); if (tr.type === 'vocal') renderLyricsInfo(tr); if (selNote && tr.type === 'vocal' && !$('tSyl')) renderEditorTools(); }
function renderEditorTools() { const keep = $('sx') ? [$('sx').scrollLeft, $('sx').scrollTop] : null; renderEditor(); if (keep) { $('sx').scrollLeft = keep[0]; $('sx').scrollTop = keep[1]; } }

// ------------------------------------------------------------------ lyrics: the AI singer's words, and an AI melody that fits them
function renderLyrics(tr) {
  const L = t();
  if (tr.type !== 'vocal') { $('lyr').innerHTML = ''; return; }
  $('lyr').innerHTML = `<div class="lyr"><div class="lh"><b>📝 ${L.lyrics}</b><small id="lInfo"></small><span class="sp"></span><button class="btn" id="lApply">${L.apply}</button><button class="btn hot" id="lAI">${L.ai}</button></div>
    <textarea id="lText" rows="4" placeholder="${esc(L.lyricsPh)}">${esc(tr.lyrics || '')}</textarea></div>`;
  $('lText').oninput = () => { tr.lyrics = $('lText').value; save(); renderLyricsInfo(tr); };
  $('lApply').onclick = async () => { await assignLyrics(tr); save(); drawNotes(); };
  $('lAI').onclick = async () => {
    const lines = lyricLines(tr.lyrics); if (!lines.length) { toast(L.aiNeedLyrics); return; }
    const need = lines.length * 2; if (song.bars < need) { setBars(Math.min(32, Math.ceil(need / 4) * 4)); }
    tr.notes = composeMelody(lines.map((l) => splitText(l).length), song.chords, song.key, song.scale, Date.now());
    // an instrument that doubles the singer follows the new tune
    for (const x of song.tracks) if (x.doubles !== undefined && song.tracks.indexOf(tr) === 0) x.notes = tr.notes.map((n) => ({ t: n.t, d: n.d, p: n.p + x.doubles, v: n.v }));
    await assignLyrics(tr); save(); renderEditorTools(); renderTracks(); startPlay();
  };
  renderLyricsInfo(tr);
}
const lyricLines = (text) => String(text || '').split(/\n|[，。！？,.!?]/).map((s) => s.trim()).filter(Boolean);
function renderLyricsInfo(tr) { const el = $('lInfo'); if (el) el.textContent = t().sylInfo(splitText(tr.lyrics || '').length, tr.notes.length); }

// ------------------------------------------------------------------ chords and the auto band
function chordPicker(bar) {
  const L = t(), deg = SCALES[song.scale], root = KEYS.indexOf(song.key), names = [];
  const qual = song.scale === 'major' ? ['', 'm', 'm', '', '', 'm', 'dim'] : ['m', 'dim', '', 'm', 'm', '', ''];
  deg.forEach((d, i) => { const r = KEYS[(root + d) % 12].replace('C#', 'Db').replace('F#', 'Gb'); names.push(r + qual[i]); if (qual[i] === '') names.push(r + '7', r + 'maj7'); if (qual[i] === 'm') names.push(r + 'm7'); });
  dialog(`<h3>${L.chords} · ${L.bars2(bar + 1)}</h3><div class="chips">${[...new Set(names)].map((c) => `<button class="cc ${c === song.chords[bar] ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>`);
  document.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { song.chords[bar] = b.dataset.c; closeDialog(); save(); renderEditorTools(); const c = chord(b.dataset.c); if (c) { const ctx = ensure(); c.iv.forEach((iv) => preview({ type: 'inst', inst: 'piano' }, 60 + c.root + iv)); } });
}
function autoDialog() {
  const L = t();
  dialog(`<h3>${L.auto}</h3>
    <label>${L.style}</label><div class="chips">${Object.entries(STYLES).map(([k, v], i) => `<button class="cc ${k === (song.style || 'pop') ? 'on' : ''}" data-st="${k}">${tx(v.n)}</button>`).join('')}</div>
    <label>${L.prog}</label><div class="chips"><button class="cc on" data-pg="">${L.keep}</button>${Object.entries(PROG_NAMES).map(([k, v]) => `<button class="cc" data-pg="${k}">${tx(v)}</button>`).join('')}</div>
    <div class="row"><button class="big" id="aGo">${L.make}</button><button class="btn" id="aNo">${L.cancel}</button></div>`);
  let st = song.style || 'pop', pg = '';
  document.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => { st = b.dataset.st; document.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('on', x === b)); });
  document.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => { pg = b.dataset.pg; document.querySelectorAll('[data-pg]').forEach((x) => x.classList.toggle('on', x === b)); });
  $('aNo').onclick = closeDialog;
  $('aGo').onclick = () => {
    if (pg) song.chords = progression(pg, song.key, song.bars);
    song.style = st; if (!song.bpmSet) song.bpm = STYLES[st].bpm;
    // the band replaces earlier auto tracks; your own tracks stay
    song.tracks = song.tracks.filter((x) => !x.auto);
    for (const tr of accompany(st, song.chords.slice(0, song.bars))) song.tracks.push({ ...tr, auto: true, vol: tr.vol ?? 0.7 });
    closeDialog(); save(); render(); startPlay();
  };
}

// ------------------------------------------------------------------ the microphone: hum a melody, or beatbox a beat, and it is written down
const BAR_CHOICES = [4, 8, 12, 16, 24, 32];
function micDialog(mode, tr) {
  const L = t(), beat = mode === 'beat', cur = tr && (beat ? tr.type === 'drums' : tr.type !== 'drums');
  const o = Object.assign({ bars: 4, from: Math.floor(playFrom / SPB), into: cur ? 'this' : 'new', snap: true, clicks: !beat }, S.mic && S.mic[mode]);
  if (!cur) o.into = 'new';
  dialog(`<h3>${beat ? L.beatT : L.humT}</h3><p class="dim">${beat ? L.beatInfo : L.humInfo}</p>
    <label>${L.recBars}</label><div class="chips">${[1, 2, 4, 8].map((n) => `<button class="cc ${n === o.bars ? 'on' : ''}" data-rb="${n}">${n}</button>`).join('')}</div>
    <label>${L.fromBar}</label><div class="chips">${Array.from({ length: Math.min(song.bars, 16) }, (_, i) => `<button class="cc ${i === o.from ? 'on' : ''}" data-fb="${i}">${i + 1}</button>`).join('')}</div>
    <label>${L.into}</label><div class="chips"><button class="cc ${o.into === 'new' ? 'on' : ''}" data-in="new">${beat ? L.newDrums : L.newPiano}</button>${cur ? `<button class="cc ${o.into === 'this' ? 'on' : ''}" data-in="this">${L.thisTrack} · ${esc(tx(tr.name))}</button>` : ''}</div>
    ${beat ? '' : `<label class="ck"><input type="checkbox" id="mSnap" ${o.snap ? 'checked' : ''}> ${L.snapKey} (${song.key} ${L.scale[song.scale]})</label>`}
    <label class="ck"><input type="checkbox" id="mClick" ${o.clicks ? 'checked' : ''}> ${L.clickOn}</label>
    <div id="mRec" class="rec" hidden><div class="cnt" id="mCnt"></div><div class="dots" id="mDots"></div><div class="lvl"><i id="mLvl"></i></div><div class="live" id="mLive"></div></div>
    <div class="mrow"><button class="big" id="mGo">${L.recStart}</button></div><div class="mrow" id="mAfter" hidden></div>`);
  const pickOne = (attr, key, conv) => document.querySelectorAll(`[${attr}]`).forEach((b) => b.onclick = () => { o[key] = conv(b.getAttribute(attr)); document.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle('on', x === b)); });
  pickOne('data-rb', 'bars', Number); pickOne('data-fb', 'from', Number); pickOne('data-in', 'into', String);
  let take = null, undo = null;
  // closing the dialog in the middle of a take stops the microphone
  $('dlg').addEventListener('close', () => { if (take) take.stop(); }, { once: true });
  const remember = () => { S.mic = S.mic || {}; S.mic[mode] = { bars: o.bars, into: o.into, snap: o.snap, clicks: o.clicks }; save(); };
  $('mGo').onclick = async () => {
    if (take) { take.stop(); return; }
    o.snap = $('mSnap') ? $('mSnap').checked : false; o.clicks = $('mClick').checked; remember();
    if (undo) { undo(); undo = null; }
    // room in the song for the take
    const need = o.from + o.bars; if (need > song.bars) setBars(BAR_CHOICES.find((n) => n >= need) || 32);
    stopPlay(true);
    $('mRec').hidden = false; $('mAfter').hidden = true; $('mGo').textContent = L.recStop; $('mCnt').textContent = L.counting;
    $('mDots').innerHTML = Array.from({ length: o.bars * 4 }, (_, i) => `<i class="${i % 4 === 0 ? 'b' : ''}"></i>`).join('');
    take = record({ bars: o.bars, bpm: song.bpm, clicks: o.clicks,
      onBeat: (n, of, counting) => { if (!$('mCnt')) return; $('mCnt').textContent = counting ? n : L.recording; $('mCnt').classList.toggle('go', !counting); if (!counting) { const d = $('mDots').children[n - 1]; if (d) d.classList.add('on'); } },
      onLevel: (rms, midi) => { if (!$('mLvl')) return; $('mLvl').style.width = Math.min(100, rms * 600) + '%'; if (!beat) $('mLive').textContent = midi ? '♪ ' + noteName(Math.round(midi)) : ''; } });
    try { await take.started; } catch (e) { take = null; $('mRec').hidden = true; $('mGo').textContent = L.recStart; toast(L.noMic); return; }
    const { pcm, rate } = await take.result; take = null;
    $('mGo').textContent = L.recStart; $('mCnt').textContent = L.listening; $('mCnt').classList.remove('go');
    await new Promise((r) => setTimeout(r, 30));
    const notes = beat ? beatToHits(pcm, rate, { bpm: song.bpm, bars: o.bars }) : humToNotes(pcm, rate, { bpm: song.bpm, bars: o.bars, key: song.key, scale: song.scale, snap: o.snap });
    if (!notes.length) { $('mCnt').textContent = L.heardNone; return; }
    // write it into the song: into this track (replacing what was in those bars) or a new one
    const off = o.from * SPB, placed = notes.map((n) => ({ ...n, t: n.t + off }));
    let target;
    if (o.into === 'this' && tr) {
      target = tr; const before = clone(tr.notes);
      tr.notes = tr.notes.filter((n) => n.t < off || n.t >= off + o.bars * SPB).concat(placed);
      undo = () => { target.notes = before; };
    } else {
      target = beat ? { name: ['鼓', 'Drums'], type: 'drums', inst: 'drums', notes: placed, vol: 0.75 } : { name: [TX.zh.humName, TX.en.humName], type: 'inst', inst: 'piano', notes: placed, vol: 0.8 };
      song.tracks.push(target); const ix = song.tracks.length - 1;
      undo = () => { const k = song.tracks.indexOf(target); if (k >= 0) song.tracks.splice(k, 1); sel = Math.min(sel, song.tracks.length - 1); };
      sel = ix;
    }
    save(); renderTracks(); renderEditorTools();
    $('mCnt').textContent = L.heard(notes.length, beat);
    $('mAfter').hidden = false;
    $('mAfter').innerHTML = `<button class="btn" id="mPlay">${L.tryIt}</button><button class="btn" id="mScore">${L.score}</button><button class="btn" id="mRe">${L.retake}</button><span class="sp"></span><button class="btn hot" id="mDone">${L.done}</button>`;
    $('mPlay').onclick = () => { playFrom = off; startPlay(); };
    $('mScore').onclick = () => scoreDialog(target);
    $('mRe').onclick = () => { if (undo) { undo(); undo = null; save(); renderTracks(); renderEditorTools(); } $('mGo').click(); };
    $('mDone').onclick = () => { closeDialog(); playFrom = off; drawHead(playFrom); };
  };
}
// sheet music for a track
async function scoreDialog(tr) {
  const L = t();
  dialog(`<h3>${L.scoreT} · ${esc(tx(tr.name))} <small class="dim">${song.key} ${L.scale[song.scale]} · ${song.bpm} BPM</small></h3><div class="score" id="scBox"></div>
    <div class="mrow"><button class="btn" id="scDl">${L.dlSvg}</button><button class="btn" id="scPr">${L.print}</button></div>`);
  $('dlg').classList.add('wide');
  $('dlg').addEventListener('close', () => $('dlg').classList.remove('wide'), { once: true });
  let svg = null;
  try { svg = await drawScore($('scBox'), song, tr, S.lang); } catch (e) { $('scBox').innerHTML = `<p style="color:#333">${L.scoreFail}</p>`; return; }
  const text = () => '<?xml version="1.0" encoding="UTF-8"?>' + new XMLSerializer().serializeToString(svg).replace('<svg ', '<svg style="background:#fff" ');
  $('scDl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text()], { type: 'image/svg+xml' })); a.download = `${song.title || 'song'} - ${tx(tr.name)}.svg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  $('scPr').onclick = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<title>${esc(song.title)}</title><h2 style="font-family:sans-serif">${esc(song.title)} · ${esc(tx(tr.name))}</h2>${new XMLSerializer().serializeToString(svg)}`); w.document.close(); w.focus(); w.print(); };
}

// ------------------------------------------------------------------ playing
async function startPlay() {
  const L = t(); ensure(); stopPlay(true);
  const need = [...new Set(song.tracks.filter((x) => x.type === 'inst').map((x) => x.inst))].filter((id) => !audio.loaded[id]);
  if (need.length) { status(L.loading); await Promise.race([Promise.all(need.map(loadInstrument)), new Promise((r) => setTimeout(r, 12000))]); status(''); }
  await assignAll();
  player.onEnd = () => { $('bPlay').textContent = '▶'; };
  play(song, playFrom, (tr, n) => n.syl, { loop: S.loop, loopFrom: 0 });
  $('bPlay').textContent = '⏸'; $('bPlay').classList.add('on');
  requestAnimationFrame(tickHead);
}
function stopPlay(quiet) { const pos = position(song); stop(); if (!quiet && pos !== null) playFrom = Math.floor(pos / 4) * 4 % (song.bars * SPB); if ($('bPlay')) { $('bPlay').textContent = '▶'; $('bPlay').classList.remove('on'); } }
function tickHead() { const pos = position(song); if (pos === null) return; drawHead(pos % (song.bars * SPB), true); requestAnimationFrame(tickHead); }
function drawHead(step, follow) {
  const ph = $('ph'); if (!ph) return; ph.style.left = step * CW + 'px';
  const sx = $('sx'); if (follow && sx) { const x = step * CW; if (x < sx.scrollLeft + 40 || x > sx.scrollLeft + sx.clientWidth - 80) sx.scrollLeft = Math.max(0, x - 80); }
}

// ------------------------------------------------------------------ songs: samples, my songs, export, share
function samplesDialog() {
  const L = t();
  dialog(`<h3>📀 ${L.samples}</h3><p class="dim">${L.aboutSamples}</p><div class="cards">${SAMPLES.map((s, i) => `<button class="card" data-s="${i}"><b>${esc(tx(s.title))}</b><small>${esc(tx(s.about))}</small></button>`).join('')}</div>`);
  document.querySelectorAll('[data-s]').forEach((b) => b.onclick = async () => { saveToMine(true); song = SAMPLES[+b.dataset.s].make(); sel = 0; selNote = null; playFrom = 0; closeDialog(); save(); render(); startPlay(); });
}
function saveToMine(quiet) {
  if (!song.tracks.some((tr) => tr.notes.length)) return;
  const id = song.id || (song.id = Date.now().toString(36)), rec = { id, title: song.title, at: Date.now(), data: strip(song) };
  const i = S.songs.findIndex((x) => x.id === id); if (i >= 0) S.songs[i] = rec; else S.songs.unshift(rec);
  S.songs = S.songs.slice(0, 30); save(); if (!quiet) toast(t().saved);
}
function mineDialog() {
  const L = t(); saveToMine(true);
  dialog(`<h3>💾 ${L.mine}</h3>${S.songs.length ? `<div class="list">${S.songs.map((x, i) => `<div class="li"><b>${esc(x.title)}</b><small>${new Date(x.at).toLocaleString()}</small><button class="btn" data-o="${i}">${L.open}</button><button class="btn" data-d="${i}">🗑</button></div>`).join('')}</div>` : `<p class="dim">${L.emptyMine}</p>`}`);
  document.querySelectorAll('[data-o]').forEach((b) => b.onclick = () => { song = clone(S.songs[+b.dataset.o].data); sel = 0; selNote = null; playFrom = 0; closeDialog(); save(); render(); });
  document.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { S.songs.splice(+b.dataset.d, 1); save(); mineDialog(); });
}
async function exportWav() {
  const L = t(); stopPlay(true); ensure();
  status(L.loading); await Promise.all([...new Set(song.tracks.filter((x) => x.type === 'inst').map((x) => x.inst))].map(loadInstrument)); await assignAll();
  status(L.rendering);
  const blob = await renderWav(song, (tr, n) => n.syl);
  status('');
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (song.title || 'song') + '.wav'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
// the song in the link itself, compressed
async function share() {
  const json = JSON.stringify(strip(song));
  let data;
  try { const cs = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw')); data = 'z' + b64u(new Uint8Array(await new Response(cs).arrayBuffer())); } catch (e) { data = 'j' + b64u(new TextEncoder().encode(json)); }
  const url = location.origin + location.pathname + '#song=' + data;
  try { await navigator.clipboard.writeText(url); toast(t().copied); } catch (e) { prompt('', url); }
}
const b64u = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function fromLink() {
  const m = location.hash.match(/song=([zj])([A-Za-z0-9_-]+)/); if (!m) return false;
  try {
    let json; const u8 = unb64u(m[2]);
    if (m[1] === 'z') json = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); else json = new TextDecoder().decode(u8);
    song = JSON.parse(json); delete song.id; history.replaceState(null, '', location.pathname); return true;
  } catch (e) { return false; }
}

// ------------------------------------------------------------------ small things
function dialog(html) { $('dlgBody').innerHTML = html; if (!$('dlg').open) $('dlg').showModal(); }
function closeDialog() { if ($('dlg').open) $('dlg').close(); }
$('dlgX').onclick = closeDialog;
function status(msg) { const el = $('status'); if (!el) return; el.hidden = !msg; el.textContent = msg; }
function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); }
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || $('dlg').open) return;
  if (e.code === 'Space') { e.preventDefault(); player.playing ? stopPlay() : startPlay(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selNote) { const tr = song.tracks[sel], i = tr.notes.indexOf(selNote); if (i >= 0) { tr.notes.splice(i, 1); selNote = null; afterEdit(tr); } }
});
audio.onLoad = () => {};

(async () => {
  await fromLink();
  render();
  try { cloud = await import('/save.js'); if (await cloud.pull(GAME, KEY)) { const n = JSON.parse(localStorage.getItem(KEY)) || {}; S = Object.assign(S, n); if (n.current && !location.hash) { song = n.current; render(); } } } catch (e) { cloud = null; }
})();
window.PS = { get song() { return song; }, set song(v) { song = v; render(); }, startPlay, stopPlay, assignAll, SAMPLES, player, audio, renderWav, exportWav };
