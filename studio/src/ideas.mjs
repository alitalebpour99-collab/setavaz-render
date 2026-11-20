// Idea engine: turns a seed (or a hand-written concept) into a full song concept: scene/story, mood, dastgah, tonic,
// genre and tempo, lead and counter instruments, the hook idea, chord flavour, arrangement template and whether any
// voice is used at all (default: none - a voice only when the concept asks for it).
import { rng } from './dsp.mjs'
import { MODES } from './theory.mjs'
const SCENES = [
  { scene: 'a night caravan crossing the Lut desert under a sky full of stars', mood: 'hypnotic, proud', modes: ['shur', 'chahargah'], genres: ['afro', 'tribal'] },
  { scene: 'rain on the rooftops of old Tehran, a window light at 2 am', mood: 'tender, yearning', modes: ['esfahan', 'shur'], genres: ['organic'] },
  { scene: 'sunset in the harbour of Bandar Abbas, lenj boats coming home', mood: 'joyful, warm', modes: ['bayatTork', 'chahargah'], genres: ['reng'] },
  { scene: 'a zurkhaneh at dusk, the morshed drum and swinging clubs', mood: 'heroic, driving', modes: ['chahargah', 'homayoun'], genres: ['tribal', 'reng'] },
  { scene: 'fog over the Caspian forest at dawn', mood: 'mysterious, calm', modes: ['homayoun', 'esfahan'], genres: ['organic', 'afro'] },
  { scene: 'Si-o-se-pol bridge in Isfahan at night, reflections on the river', mood: 'romantic, nostalgic', modes: ['esfahan', 'bayatTork'], genres: ['organic', 'afro'] },
]
const TONIC = { shur: 146.83, homayoun: 146.83, esfahan: 110.0, chahargah: 130.81, bayatTork: 174.61 } // D3, D3, A2, C3, F3
const LEADS = { afro: ['bowed', 'ney', 'tar'], organic: ['santur', 'ney', 'bowed'], reng: ['reed', 'tar', 'santur'], tribal: ['reed', 'tar', 'bowed'] }
const COUNTERS = { bowed: 'santur', ney: 'santur', tar: 'santur', santur: 'tar', reed: 'tar' }
const HOOKS = { afro: ['callResponse', 'ostinato'], organic: ['longLine', 'risingSequence', 'callResponse'], reng: ['callResponse', 'ostinato'], tribal: ['ostinato', 'risingSequence'] }
export function makeConcept(seed, over = {}) {
  const r = rng(seed * 7919 + 13), pick = (a) => a[Math.floor(r() * a.length)]
  const sc = over.scene ? SCENES.find((s) => s.scene === over.scene) || { scene: over.scene, mood: over.mood || 'calm', modes: [over.mode], genres: [over.genre] } : pick(SCENES)
  const genre = over.genre || pick(sc.genres), mode = over.mode || pick(sc.modes)
  const G = { afro: [120, 124], organic: [110, 116], reng: [122, 126], tribal: [124, 128] }[genre]
  const bpm = over.bpm || Math.round(G[0] + r() * (G[1] - G[0]))
  const lead = over.lead || pick(LEADS[genre])
  const c = {
    seed, title: over.title || null, scene: sc.scene, mood: over.mood || sc.mood, mode, modeMood: MODES[mode].mood, tonicHz: over.tonicHz || TONIC[mode],
    genre, bpm, lead, counter: over.counter || COUNTERS[lead], hook: over.hook || pick(HOOKS[genre]),
    flavour: over.flavour || (/joy|bright|warm|hope/.test(sc.mood) ? 'bright' : /calm|myster|tender/.test(sc.mood) ? 'floating' : 'dark'),
    voice: over.voice || 'none', lyria: over.lyria || null,
    form: over.form || [['intro', 8], ['build', 8], ['dropA', 16], ['break', 8], ['switch', 8], ['dropB', 16], ['bridge', 8], ['final', 8], ['outro', 4]],
  }
  return c
}
