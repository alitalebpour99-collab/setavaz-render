// Drum and bass pattern library per genre and section role, plus variation, fills and the rhythmic "pocket".
// Pattern strings: one char per grid step (16 per bar, or 12 for the 6/8 reng grid). X=1, x=.75, o=.55, g=.35 (ghost), .=rest
export const VEL = { X: 1, x: 0.75, o: 0.55, g: 0.35 }
export const GENRES = {
  afro: { grid: 16, swing: 0.56, bpm: [120, 124],
    A: { kick: 'X...X...X...X...', hatO: '..x...x...x...x.', shk: 'oxgoxgoxoxgoxgox', rim: '......x.......x.', congaL: '...x......x.....', congaH: '.......x.....x..', daf: 'X...............' },
    B: { kick: 'X...X...X...X..g', hatO: '..x...x...x...x.', shk: 'oxgoxgoxoxgoxgox', clap: '....o.......o...', congaL: '...x..o...x.....', congaH: '.....g.x.....x.g', dafS: '...........x....', daf: 'X.......o.......' },
    C: { kick: 'X...X.......X...', bak: '........X.....g.', shk: 'xgxgxgxgxgxgxgxg', rim: '...x......x.....', congaL: '..x..x......x...', congaH: '.x......x..x...x', daf: 'X.......X.......' }, // 3-step switch
    half: { kick: 'X.......X.......', clap: '........X.......', hatC: 'x.x.x.x.x.x.x.x.', daf: 'X...............', tom: '......o........o' },
    intro: { kick: 'X...X...X...X...', shk: 'g.g.g.g.g.g.g.g.', daf: 'X...............' },
    brk: { daf: 'X.......o.......', shk: 'g...g...g...g...' },
    bass: { A: [2, 6, 10, 14], B: [2, 6, 7, 10, 14, 15], C: [3, 6, 11, 14], half: [0], ghost: [7] } },
  organic: { grid: 16, swing: 0.58, bpm: [110, 116],
    A: { kick: 'X...X...X...X...', clap: '....o.......o...', hatC: '..x...x...x...x.', shk: 'g.o.g.o.g.o.g.o.', daf: 'X......gX......g' },
    B: { kick: 'X...X...X...X.g.', clap: '....x.......x...', hatC: '..x...x...x...x.', shk: 'gogogogogogogogo', tom: '..........o.....', bak: '.......g.......g', congaH: '...g......o.....' },
    C: { kick: 'X......oX.o.....', clap: '....X.......X...', hatC: 'x.x.x.x.x.x.x.xo', bak: '..g.....g..g....', daf: 'X...............' }, // broken half-time switch
    half: { kick: 'X.......o.......', clap: '........x.......', shk: 'g...g...g...g...', daf: 'X.......' + '........' },
    intro: { kick: 'X.......X.......', shk: 'g...g...g...g...', daf: 'X...............' },
    brk: { daf: 'X...............', shk: 'g.......g.......' },
    bass: { A: [0, 10], B: [0, 7, 10], C: [0, 3, 8], half: [0], ghost: [14] } },
  reng: { grid: 12, swing: 0.5, bpm: [122, 126], // 4 beats x 3 triplets: the Persian 6/8 dance bounce over a house pulse
    A: { kick: 'X..X..X..X..', tom: 'X.....X.....', bak: '..x..x..x..x', gclap: '..o.....o...', shk: 'xgoxgoxgoxgo', hatO: '..g..g..g..g' },
    B: { kick: 'X..X..X..X..', dohol: 'X....xX.....', bak: '.gx..x.gx..x', gclap: '..x..o..x..x', shk: 'xgoxgoxgoxgo', hatO: '..o..o..o..o', dafS: '.....x......' },
    C: { kick: 'X.....X.....', dohol: 'X..x..X..x..', bak: 'xgxgxgxgxgxg', gclap: '...x.....x..', hatO: '..x..x..x..x' }, // half-time reng with tombak riz
    half: { kick: 'X.....X.....', tom: 'X.....X.....', gclap: '...x.....x..', shk: 'g..g..g..g..' },
    intro: { kick: 'X..X..X..X..', shk: 'g.og.og.og.o', tom: 'X...........' },
    brk: { tom: 'X.....o.....', shk: 'g..g..g..g..' },
    bass: { A: [2, 5, 8, 11], B: [0, 2, 5, 8, 11], C: [0, 5, 6, 11], half: [0], ghost: [10] } },
  tribal: { grid: 16, swing: 0.5, bpm: [124, 128],
    A: { kick: 'X...X...X...X...', clap: '....x.......x...', hatO: '..x...x...x...x.', tom: '...x...x.x.x...x', shk: 'xgxgxgxgxgxgxgxg' },
    B: { kick: 'X...X...X...X...', clap: '....x.......x...', hatO: '..x...x...x...x.', tom: '.x.x...x.x.x.x.x', bak: '..g...g...g...g.', shk: 'xgxgxgxgxgxgxgxg', dohol: 'X.......X.......' },
    C: { kick: 'X.......X.......', clap: '....X.......X...', tom: 'xgxgxgxgxgxgxgxg', hatC: 'x.x.x.x.x.x.x.x.' },
    half: { kick: 'X.......X.......', clap: '........X.......', tom: '...x...x...x...x' },
    intro: { kick: 'X...X...X...X...', hatC: '..g...g...g...g.' },
    brk: { tom: 'X.......o.......' },
    bass: { A: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], B: [2, 3, 6, 7, 10, 11, 14, 15], C: [3, 7, 11, 15], half: [0], ghost: [] } },
}
// per-instrument micro-timing in seconds (shakers push, rims/congas/claps sit back)
export const POCKET = { shk: -0.004, rim: 0.009, congaH: 0.004, congaL: 0.007, clap: 0.006, gclap: 0.006, hatO: 0.002, bak: 0.005, tom: 0.003 }
// variation: add/move ghost notes on non-kick parts so two blocks are never identical
export function vary(pat, rnd, amount = 0.25) {
  const out = {}
  for (const [k, p] of Object.entries(pat)) {
    if (k === 'kick' || rnd() > amount * 2.2) { out[k] = p; continue }
    const a = p.split('')
    const empty = a.map((c, i) => (c === '.' ? i : -1)).filter((i) => i >= 0)
    if (empty.length && rnd() < 0.7) a[empty[Math.floor(rnd() * empty.length)]] = 'g'
    const hits = a.map((c, i) => (c !== '.' ? i : -1)).filter((i) => i > 0)
    if (hits.length > 2 && rnd() < 0.4) { const i = hits[Math.floor(rnd() * hits.length)]; a[i] = '.' }
    out[k] = a.join('')
  }
  return out
}
export const signature = (pat) => Object.entries(pat).sort().map(([k, v]) => k + ':' + v).join('|')
// fills on the last beat(s) of a block; returns [{inst, beatOffset(0..4 within bar), vel, pan}]
export function fill(type, rnd, grid = 16) {
  const ev = []
  if (type === 'tomRoll') for (let k = 0; k < 6; k++) ev.push({ inst: k % 2 ? 'bak' : 'tom', at: 3 + k / 6, v: 0.5 + k * 0.08, pan: k % 2 ? 0.3 : -0.3 })
  if (type === 'riz') for (let k = 0; k < 12; k++) ev.push({ inst: 'bak', at: 3 + k / 12, v: 0.25 + k * 0.05, pan: (k % 2 ? 0.2 : -0.2) })
  if (type === 'dafRoll') for (let k = 0; k < 8; k++) ev.push({ inst: 'dafS', at: 2 + k / 4, v: 0.3 + k * 0.06, pan: 0 })
  if (type === 'clapRun') for (let k = 0; k < 4; k++) ev.push({ inst: grid === 12 ? 'gclap' : 'clap', at: 3 + k / 4, v: 0.4 + k * 0.12, pan: 0 })
  if (type === 'snareBuild') for (let b = 0; b < 4; b++) { const per = b < 2 ? 4 : b === 2 ? 8 : 16; for (let k = 0; k < per; k++) ev.push({ inst: 'clap', bar: b, at: k * 4 / per, v: 0.15 + 0.6 * (b * 4 + k * 4 / per) / 16, pan: 0 }) }
  return ev
}
export const FILLS = { afro: ['tomRoll', 'riz', 'dafRoll'], organic: ['riz', 'tomRoll', 'clapRun'], reng: ['riz', 'clapRun', 'tomRoll'], tribal: ['tomRoll', 'clapRun', 'riz'] }
