// How well a picture's brightness follows the sound's hits (the gate's beat-sync check). Only numbers: the onsets
// are measured from the track by the Setavaz app on its own server and arrive in the job; no sound is here.
export const FPS = 30;

/**
 * The hit envelope at time t: each onset rises over `attack` seconds and dies away with `decay`. It is 0
 * on frame 0 (the first hit is still rising), so the first and last frames match and the Short loops.
 */
export function hitAt(onsets, t, { attack = 0.05, decay = 0.16, pick = () => 1 } = {}) {
  let v = 0;
  for (let i = onsets.length - 1; i >= 0; i--) {
    const o = onsets[i];
    const d = t - o.t;
    if (d < 0) continue;
    if (d > decay * 6 + attack) break;
    const a = d < attack ? d / attack : Math.exp(-(d - attack) / decay);
    v = Math.max(v, o.s * pick(o) * a);
  }
  return v;
}

/** Pearson correlation of two equal-length series. */
export function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

/** A series minus its own moving average (±r samples): only the quick changes stay. */
export function highpass(x, r = 8) {
  return x.map((v, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - r); k <= Math.min(x.length - 1, i + r); k++) {
      s += x[k];
      n++;
    }
    return v - s / n;
  });
}

/**
 * How well a picture's per-frame brightness follows the sound's hits: the best Pearson r over a lag of
 * 0 to 4 frames between the high-passed brightness and the hit envelope (both per video frame).
 */
export function beatSync(bright, onsets, frames) {
  const hits = Array.from({ length: frames }, (_, f) => hitAt(onsets, f / FPS));
  const v = highpass(bright.slice(0, frames));
  const h = highpass(hits);
  let best = { r: -1, lag: 0 };
  for (let lag = 0; lag <= 4; lag++) {
    const r = pearson(v.slice(lag), h.slice(0, h.length - lag));
    if (r > best.r) best = { r, lag };
  }
  return best;
}
