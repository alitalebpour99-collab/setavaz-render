# setavaz-render

Motion graphics for **Setavaz** (music brand), rendered with [HyperFrames](https://github.com/heygen-com/hyperframes)
(Apache 2.0) on GitHub Actions.

- `teaser/`: a 24 s 9:16 Reel teaser for the track «Setareh Code» on its second drop, with the end card.
- `longform/`: a 48 s 16:9 proof of the long-form music video (breakdown, build, second drop).
- `shared/scene.js`: the canvas scene. It is drawn only from the timeline's time, so every frame is reproducible.

The music is **not** in this repo. `*/data.js` holds numbers measured from it (bass, loudness, hats, kicks per
video frame); the renders are silent, and the sound is added afterwards elsewhere. Nothing here is posted anywhere.

Fonts: EB Garamond, Inter Display and Vazirmatn (SIL Open Font License 1.1). Logo and background plates © Setavaz.

## Round-3 Shorts (`r3/`)

One lit 3D world per track (three.js in a headless Chrome, `r3/page/`, objects in `r3/library/`), 9:16 Shorts and 16:9
long videos, English only, gated before anything reaches the owner (`r3/gate.mjs`). Moved here from the app's private repo on 19 Nov 2026
so every render runs on free minutes.

- **How it starts:** the Setavaz panel («کارها» › ساخت ویدیو) dispatches `.github/workflows/r3.yml` with `what = r3`,
  `tracks = ["<track>"]` (names the run) and `job`: the job from the app's `lib/r3job.ts`, gzip then base64. The job
  holds the track's name, tempo, length and world (`content/formats.json` r3 in the app), the brand star, the words
  that are never written, and the window's sound **as numbers only** (onsets and loudness per video frame), measured
  on the app's own server. No sound file, no file name, no secret: the job is as public as this repo.
- **What comes back:** the artifact `r3-<track>`: the **silent** picture `r3-<track>.mp4`, its cover frame, contact
  sheets and `r3-<track>.report.json` (the gate's checks). The app reads it with the panel's token, puts the track
  under the picture on its own server, and checks the loudness (-14 LUFS, true peak -1 dBTP or lower) and the size
  there.
- **The token** (panel › تنظیمات › کلیدها › GitHub): fine-grained, *Repository access: only setavaz-render*,
  *Permissions: Actions read and write, Contents read-only*. The panel's test reads `r3.yml` and makes a dispatch to a
  branch that does not exist (GitHub answers 422 only when the token may start workflows here; nothing runs).
- **Pull requests** touching `r3/` render the cheap look (the turntable of every library object and the key frames of
  each test job in `r3/jobs/`) and run `npm test`. The test jobs come from the app's `scripts/r3-jobs.ts` (the
  catalogue's beat grid instead of the measured sound); make them again when the catalogue or a world changes.
- **Long videos** (`what = r3-long`, 20 Nov 2026): the same worlds at 16:9 over the whole track. The job's `conf.format` is
  `long` with `lengthS`; the run splits the frames into parts of about 20 seconds (`plan.mjs partsOf`), draws each part
  on its own runner (`render.mjs --part k`, a matrix) and `join.mjs` puts them together without encoding again, then gates
  the whole (16:9 title-safe frame, words on at most 15% of the frames, the badge once after the first drop, bottom left).
  Still one run per video; the artifact is `r3-<video>` as for a Short.
- **Worlds that know their track** (Yalda, Night Drive, Focus): `conf.marks` gives the sections' starts in the track's own
  seconds (measured once from the master); the scene is a function of the track's time, so a Short and the long video
  show the same moment the same way, and `kit.mjs directShots` cuts each section on its downbeats. `kit.mjs fitPose`
  frames an object's bounding sphere for either shape of video.
- **Bazaar Lights and Kahkeshan** (21 Nov 2026): a covered Persian bazaar at golden hour whose pierced brass lanterns light
  one a beat on the drop and throw their stars on the vault in the breakdown (`scenes/bazaar.mjs`, `sets/bazaar.mjs`,
  `models/lantern.mjs`, `models/spice.mjs`); a night camp in the desert where a brass astrolabe's rete turns with the music
  under the Milky Way, which wheels round the pole in the second drop (`scenes/kahkeshan.mjs`, `sets/desert.mjs`,
  `models/astrolabe.mjs`, `models/daf.mjs`). Textures in `textures/worlds.mjs`.
- Locally: `cd r3 && npm ci && npm test`; a render needs Chrome and ffmpeg (`node render.mjs --job jobs/last-ember.json
  --stills`), so it belongs on the runners.
