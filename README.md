# 流行歌製作人 Pop Studio

Be a pop music producer in the browser: **https://ywchen0711.github.io/pop-studio/**

- **Real instruments**: 20 sampled General MIDI instruments (piano, e-piano, guitars, bass, strings, sax, synths, pads,
  music box…) loaded on demand from the FluidR3 soundfont, with a synthesizer as a fallback; 10 synthesized drums.
- **Write the music**: a piano roll for each track (draw, drag, resize, erase; in-key rows highlighted), a drum step grid,
  a chord lane, BPM, key and scale, 4–32 bars, mute / solo / volume per track.
- **Auto band**: pick a style (pop, ballad, dance, lo-fi, synthwave, rock) and a chord progression (four-chord pop, canon,
  royal road, jazzy ii–V–I…) and get chords, bass, drums and extras in one click.
- **Lyrics and the AI singer**: type lyrics, the singer sings one syllable per note. It is a formant singing synthesizer
  written for this app: Chinese lyrics become pinyin (pinyin-pro) and English lyrics are split into syllables by spelling
  rules (use hyphens like `twin-kle` to place them yourself, `~` to hold a syllable); the voice sings each note in tune with
  vibrato, consonants and vowel glides. Five voices: sweet girl, warm boy, kid, robot, choir.
- **AI melody**: write a few lines of lyrics and it composes a melody that fits the syllables and the chords.
- **Sample songs**: four original pop-style songs (晴天的約定, Midnight Drive, 下雨的咖啡館, Dance Floor Lights) and three
  public-domain tunes (小星星, Twinkle Twinkle, 兩隻老虎). Today's pop hits are copyrighted, so they are not included.
- Export to WAV, share a song as a link, save songs (cloud saves like the other games on the site), 中文 / English.

```
js/sound.js   instruments (soundfont + synth), drums, mixer and reverb, scheduler, WAV rendering
js/voice.js   the singer: syllables from lyrics, formant singing synthesis
js/music.js   keys and chords, auto band styles, AI melody, sample songs
js/app.js     the studio
```
