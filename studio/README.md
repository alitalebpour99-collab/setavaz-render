# Setavaz studio (v1)

Code-first music production for Setavaz. The beat, the bass, the chords and the lead melody are composed and rendered here, in code: Persian modes with real quarter tones (koron), Persian percussion, and arrangements built from 8- and 16-bar phrases. Lyria is optional and only ever adds a texture or a solo-instrument layer. It never plays the beat.

```
node studio/bin/make.mjs --out out --concept studio/concepts/kavir-e-shab.json   # or --seed 7 for a generated idea
```

Requirements are Node 20+ and ffmpeg. There are no npm dependencies, and every sound is synthesised in `src/dsp.mjs` and `src/instruments.mjs`, so there are no third-party samples or licences to track. The workflow `.github/workflows/studio-render.yml` renders the demo concepts on GitHub Actions and uploads the MP3s and their JSON reports as an artifact.

## Pipeline

| Stage | File | What it does |
|---|---|---|
| Idea engine | `src/ideas.mjs` | Turns a seed or a concept file into a full concept: scene or story, mood, dastgah and tonic, genre and tempo, lead and counter instruments, hook idea, chord flavour and form. The voice is `none` unless the concept asks for one. |
| Theory | `src/theory.mjs` | Holds the modes (Shur, Homayoun, Esfahan, Chahargah, Bayat-e Tork) in cents. Builds chords that avoid koron notes, using open fifths where the third is a koron. Composes a motif from a hook rhythm, with the shahed as focal note and the ist as cadence. Develops it with repeat, sequence, inversion, displacement, sparse, answer and octave. Ornaments are grace notes and a tahrir-like trill. |
| Rhythm | `src/rhythm.mjs` | Pattern library per genre and role (A, B, a C switch groove, half-time, intro, break) for afro house, organic deep house, reng (Persian 6/8 dance on a triplet grid) and tribal. It also holds the variation operator, a per-instrument pocket (micro-timing) and fills (tom roll, tombak *riz*, daf roll, clap run, snare build). |
| Composer and arranger | `src/song.mjs` | The form is intro, build, drop A, break, switch, drop B, bridge, final and outro. Every 8-bar block gets a drum variant that differs from the previous block, so the rhythm changes at least every 16 bars. Drop B uses a different groove, and the bridge is half-time. Fills come every 8 bars and sometimes every 4. There are risers into drops, impacts on drops, a downlifter into the break and half a beat of silence before each drop. Automation filters the drums open in the intro and sweeps the pad open in the build. The counter instrument plays arpeggios in the drops and call and response in the bridge. |
| Mixer | `src/song.mjs` | Sidechain is driven by the actual kick times. The lead gets a reverb and a dotted-8th delay, the drums get a room, the lows stay mono and only the band above 300 Hz is widened. The mix is gain-staged to -18 dBFS. |
| Master and quality gate | `src/finish.mjs` | Mastering is a limiter plus two-pass loudnorm to -14 LUFS, with no multiband compression so the drop-to-break contrast survives. The gate rejects a song when the same drum block runs for more than 16 bars, when it has fewer than 6 different blocks, when the drops are not at least 6 dB above the break, when the overall contrast is under 8 dB, when less than 60 % of the pitched energy falls in the mode's pitch classes, when loudness is off -14 LUFS, or when the length falls outside 2:20 to 3:20. A rejected song is rebuilt as a new variant. |

## Research notes (short)

- **Arrangement.** Dance tracks move in 8- and 16-bar blocks, with elements changing every 4 or 8 bars. A drop hits because of the build before it: filtered kicks, rising noise and a snare roll. Breakdowns strip the drums, and hats and shakers are held back for the peak. Sources: [MusicRadar](https://musicradar.com/news/song-arrangement-template-explained), [Mixed In Key](https://mixedinkey.com/captain-plugins/wiki/how-to-arrange-a-dance-music-track/), [Beat Kitchen](https://beatkitchen.io/guides/electronic-music/06-arrangement-and-energy/), [Cymatics](https://cymatics.fm/blogs/production/edm-song-structure).
- **Persian intervals.** Vaziri's koron and sori mark roughly a quarter-tone flat and sharp. Farhat measured two neutral steps of about 135 and 165 cents ([arXiv 2108.01283](https://ar5iv.labs.arxiv.org/html/2108.01283), [LilyPond, Persian classical music](https://lilypond.org/doc/v2.24/Documentation/notation/persian-classical-music), [Wikipedia, Dastgah](https://wikipedia.com/wiki/Dastgah)). The cents used here are practical approximations, not a theory claim.
- **Tombak.** The two core strokes are *tom* (low, centre) and *bak* (edge). *Reng* is the fast 6-beat dance rhythm ([Wikipedia, Tombak](https://en.wikipedia.com/wiki/Tombak), [Handpan rhythm library](https://handpandojo.masterthehandpan.com/video-categories/persian)). Our reng patterns are a production interpretation.
- **Generative melody.** The approach is motif-driven development (repetition and variation) rather than free random notes, with velocity and timing varied together ([UMD notes](https://user.eng.umd.edu/~blj/algorithmic_composition/nebula.html), [MIDI generative techniques](https://cjgdev.github.io/midi-markdown/tutorials/generative-techniques)).
