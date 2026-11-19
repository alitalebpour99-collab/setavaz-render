/* Setavaz: "Setareh Code" motion graphics. One canvas, drawn only from the timeline's time (no clock, no Math.random).
   The music is seen through numbers measured on the laptop (window.SV_DATA: sub, full, high per frame, kick flags);
   the audio itself never enters this repo. Idea: the stars of the desert sky are a code; on the build they connect
   into a Persian eight-point star (girih), on the drop it ignites and every kick sends gold sparks out of it. */
(function () {
  const GOLD = '#F4C35A', IVORY = '#F6ECD3'
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
  const ease = (x) => x * x * (3 - 2 * x)
  const easeIn = (x) => x * x * x

  function make(canvas, plate, opts) {
    const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d')
    const D = window.SV_DATA, fps = D.fps
    const S = opts.sections // [{name, start, end, kind: 'build'|'drop'|'breakdown'|'outro'}] in window seconds
    const cx = W / 2, cy = H * opts.starY, R = Math.min(W, H) * opts.starR
    const r = rng(1119)
    const stars = Array.from({ length: opts.stars }, () => ({ x: r() * W, y: r() * H * 0.78, s: 0.4 + r() * r() * 2.4, p: r() * 6.28, d: 0.2 + r() * 0.8 }))
    const streaks = Array.from({ length: 90 }, () => ({ x: r() * W, y0: H * (0.62 + r() * 0.35), v: 0.3 + r() * 0.7, ph: r(), w: 0.6 + r() * 1.6 }))
    const sparkDirs = Array.from({ length: 28 }, (_, i) => ({ a: (i / 28) * 6.283 + r() * 0.2, v: 0.55 + r() * 0.6, s: 1 + r() * 2.2 }))
    const kicks = []; D.kick.forEach((k, i) => { if (k) kicks.push(i / fps) })
    const at = (arr, t) => { const i = clamp(Math.floor(t * fps), 0, arr.length - 1); return arr[i] }
    const smooth = (arr, t, n = 4) => { let s = 0; for (let k = 0; k < n; k++) s += at(arr, t - k / fps); return s / n }
    const sec = (t) => S.find((s) => t >= s.start && t < s.end) || S[S.length - 1]
    const prog = (s, t) => clamp((t - s.start) / (s.end - s.start))
    const firstDrop = S.find((s) => s.kind === 'drop')

    // the girih: 16 outer/inner vertices of an eight-point star, an octagram {8/3}, an inner octagon
    function girih(scale) {
      const P = []
      for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 8; const rr = k % 2 ? R * 0.52 * scale : R * scale; P.push([Math.cos(a) * rr, Math.sin(a) * rr]) }
      const lines = []
      for (let k = 0; k < 16; k++) lines.push([P[k], P[(k + 1) % 16]])
      const O = []; for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 4; O.push([Math.cos(a) * R * 0.86 * scale, Math.sin(a) * R * 0.86 * scale]) }
      for (let k = 0; k < 8; k++) lines.push([O[k], O[(k + 3) % 8]])
      const I = []; for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + Math.PI / 8 + (k * Math.PI) / 4; I.push([Math.cos(a) * R * 0.3 * scale, Math.sin(a) * R * 0.3 * scale]) }
      for (let k = 0; k < 8; k++) lines.push([I[k], I[(k + 1) % 8]])
      return { lines, dots: P.filter((_, k) => k % 2 === 0) }
    }

    function draw(t) {
      const s = sec(t), sub = smooth(D.sub, t, 3), full = smooth(D.full, t, 6), high = smooth(D.high, t, 3)
      const inDrop = s.kind === 'drop', inBuild = s.kind === 'build', inBreak = s.kind === 'breakdown'
      const dropT = inDrop ? t - s.start : -1
      // last kick envelope (attack 1 frame, 0.35 s release)
      let kAge = 9; for (let i = kicks.length - 1; i >= 0; i--) if (kicks[i] <= t) { kAge = t - kicks[i]; break }
      const kEnv = inDrop ? Math.exp(-kAge / 0.12) : 0

      // 1. the plate, a slow push-in, a breath on the bass
      const push = 1.04 + 0.08 * (t / opts.duration) + 0.012 * kEnv + (inDrop ? 0.006 * sub : 0)
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#120E3F'; ctx.fillRect(0, 0, W, H)
      if (plate.complete && plate.naturalWidth) {
        const iw = plate.naturalWidth, ih = plate.naturalHeight, k = Math.max(W / iw, H / ih) * push
        ctx.globalAlpha = inBreak ? 0.72 : 1
        ctx.drawImage(plate, cx - (iw * k) / 2, H / 2 - (ih * k) / 2 - H * 0.01 * (t / opts.duration), iw * k, ih * k)
        ctx.globalAlpha = 1
      }
      // 2. darkness: the build pulls the light in, the drop lets it out
      let dark = 0.18
      if (inBuild) dark = 0.18 + 0.45 * easeIn(prog(s, t))
      if (inBreak) dark = 0.32
      if (s.kind === 'outro') dark = 0.18 + 0.6 * prog(s, t)
      ctx.fillStyle = `rgba(10,8,38,${dark})`; ctx.fillRect(0, 0, W, H)

      // 3. the sky's stars: twinkle with the hats, drift with the camera
      ctx.save()
      for (const st of stars) {
        const tw = 0.35 + 0.35 * Math.sin(st.p + t * (1.2 + st.d * 2)) + 0.6 * high * st.d
        const x = (st.x - cx) * push + cx, y = (st.y - H / 2) * push + H / 2 - t * 3 * st.d
        ctx.globalAlpha = clamp(tw) * (inBuild ? 1 - 0.5 * prog(s, t) : 1)
        ctx.fillStyle = st.s > 2 ? GOLD : IVORY
        ctx.beginPath(); ctx.arc(x, ((y % H) + H) % H, st.s * (1 + 0.4 * high), 0, 6.283); ctx.fill()
      }
      ctx.restore()

      // 4. build: light rises out of the dunes, faster and denser toward the drop
      if (inBuild) {
        const p = prog(s, t)
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        const n = Math.floor(streaks.length * (0.25 + 0.75 * p))
        for (let i = 0; i < n; i++) {
          const q = streaks[i], cyc = ((t - s.start) * q.v * (0.5 + 2.2 * p) + q.ph) % 1
          const y = q.y0 - cyc * H * 0.75, len = 30 + 160 * p * q.v
          const g = ctx.createLinearGradient(q.x, y, q.x, y + len); g.addColorStop(0, 'rgba(244,195,90,0.9)'); g.addColorStop(1, 'rgba(244,195,90,0)')
          ctx.globalAlpha = (1 - cyc) * (0.3 + 0.7 * p); ctx.strokeStyle = g; ctx.lineWidth = q.w * (1 + p)
          ctx.beginPath(); ctx.moveTo(q.x, y); ctx.lineTo(q.x, y + len); ctx.stroke()
        }
        ctx.restore()
      }

      // 5. the girih: drawn line by line on the build (or slowly in the breakdown), lit on the drop
      let draw = 0, glow = 0, lw = 1.2, rot = 0, scale = 1
      if (inBreak) { draw = 0.12 + 0.38 * prog(s, t); glow = 0.25 + 0.4 * full; lw = 1 }
      if (inBuild) { const b0 = opts.buildFrom ?? 0.5; draw = b0 + (1 - b0) * ease(prog(s, t)); glow = 0.35 + 0.4 * prog(s, t); lw = 1.4 }
      if (inDrop) { draw = 1; glow = 0.75 + 0.25 * sub; lw = 2 + 3 * sub + 3 * kEnv; rot = dropT * 0.06; scale = 1 + 0.035 * sub + 0.05 * kEnv + 0.12 * Math.exp(-dropT / 0.25) }
      if (s.kind === 'outro') { draw = 1; glow = 0.6 * (1 - prog(s, t)); lw = 1.5; rot = 0.2 }
      if (!inBuild && !inBreak && !inDrop && s.kind !== 'outro') { draw = 0.05; glow = 0.2 }
      const G = girih(scale)
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalCompositeOperation = 'lighter'
      ctx.shadowColor = GOLD; ctx.shadowBlur = 18 + 40 * glow
      const total = G.lines.length, shown = draw * total
      for (let i = 0; i < total; i++) {
        const f = clamp(shown - i); if (f <= 0) break
        const [a, b] = G.lines[i]
        ctx.globalAlpha = clamp(0.25 + glow) * (i < 16 ? 1 : 0.7)
        ctx.strokeStyle = i < 16 ? GOLD : IVORY; ctx.lineWidth = i < 16 ? lw : lw * 0.6
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); ctx.stroke()
      }
      // the eight outer vertices are stars
      for (const [x, y] of G.dots) { ctx.globalAlpha = clamp(0.4 + glow); ctx.fillStyle = IVORY; ctx.beginPath(); ctx.arc(x, y, 2.5 + 4 * glow + 4 * kEnv, 0, 6.283); ctx.fill() }
      // the heart: a four-point star like the logo's, breathing with the sub
      const hr = R * (0.1 + 0.05 * sub + 0.08 * kEnv) * (inDrop ? 1 : 0.6 + 0.4 * draw)
      ctx.globalAlpha = clamp(0.3 + glow); ctx.fillStyle = GOLD; ctx.beginPath()
      for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 4, rr = k % 2 ? hr * 0.28 : hr; ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr) }
      ctx.closePath(); ctx.fill()
      ctx.restore()

      // 6. every kick in a drop sends a ring of gold sparks out of the star
      if (inDrop || s.kind === 'outro') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = GOLD
        for (let i = kicks.length - 1; i >= 0; i--) {
          const age = t - kicks[i]; if (age < 0) continue; if (age > 1.1) break
          if (kicks[i] < (firstDrop ? firstDrop.start : 0)) continue
          const life = 1 - age / 1.1
          // a thin gold shock ring
          ctx.globalAlpha = 0.55 * life * life; ctx.strokeStyle = GOLD; ctx.lineWidth = 2 + 3 * life
          ctx.beginPath(); ctx.arc(cx, cy, R * (0.4 + 1.5 * (1 - Math.exp(-age / 0.3))), 0, 6.283); ctx.stroke()
          // sparks with a soft halo
          for (const d of sparkDirs) {
            const dist = R * (0.35 + d.v * 1.6 * (1 - Math.exp(-age / 0.35)))
            const x = cx + Math.cos(d.a + i) * dist, y = cy + Math.sin(d.a + i) * dist, rad = (2.5 + d.s * 2.2) * (0.3 + 0.7 * life)
            const h = ctx.createRadialGradient(x, y, 0, x, y, rad * 3.2)
            h.addColorStop(0, 'rgba(255,236,190,0.95)'); h.addColorStop(0.35, 'rgba(244,195,90,0.55)'); h.addColorStop(1, 'rgba(244,195,90,0)')
            ctx.globalAlpha = life; ctx.fillStyle = h
            ctx.beginPath(); ctx.arc(x, y, rad * 3.2, 0, 6.283); ctx.fill()
          }
        }
        ctx.restore()
      }

      // 7. the drop's first light, and a soft bloom that follows the loudness
      if (inDrop && dropT < 0.6) { ctx.fillStyle = `rgba(246,236,211,${0.55 * Math.exp(-dropT / 0.14)})`; ctx.fillRect(0, 0, W, H) }
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.2)
      bloom.addColorStop(0, `rgba(244,195,90,${(inDrop ? 0.22 : 0.08) * (0.5 + full)})`); bloom.addColorStop(1, 'rgba(244,195,90,0)')
      ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H)
      // vignette
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
      v.addColorStop(0, 'rgba(8,6,30,0)'); v.addColorStop(1, 'rgba(8,6,30,0.7)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
    }
    return draw
  }

  // Drive the canvas from a GSAP timeline: a tween on a function property calls the setter on every render,
  // including direct seeks with events suppressed, so each frame is drawn from the seeked time only.
  window.svBind = function (tl, canvas, plate, opts) {
    const draw = make(canvas, plate, opts)
    let cur = 0
    const proxy = { t: function (v) { if (v === undefined) return cur; cur = v; draw(v) } }
    tl.fromTo(proxy, { t: 0 }, { t: opts.duration, duration: opts.duration, ease: 'none' }, 0)
    draw(0)
    return draw
  }
})()
