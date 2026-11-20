// The little that is written on a round-3 Short, and the film finish. Words: the track's name with the star mark,
// small, for a few seconds near the start (the signature) and on the end card with «Coming soon»; a small badge in the
// bottom-left corner at the close. English only. Everything else on the frame is the picture.
export const SAFE = { left: 60, right: 900, top: 220, bottom: 1500 };
/** The long video's title-safe frame (16:9). */
export const SAFE_LONG = { left: 96, right: 1824, top: 70, bottom: 1020 };
const IVORY = '#F6ECD3';
const GOLD = '#F4C35A';

export async function loadFonts() {
  const faces = [
    new FontFace('EB Garamond', 'url(/fonts/EBGaramond-Variable.ttf)', { weight: '400 800' }),
    new FontFace('Inter Display', 'url(/fonts/InterDisplay-SemiBold.ttf)', { weight: '600' }),
  ];
  for (const f of faces) { await f.load(); document.fonts.add(f); }
}

const fade = (t, from, to, fin, fout) => {
  if (t < from || t > to) return 0;
  return Math.max(0, Math.min(1, (t - from) / fin, fout > 0 ? (to - t) / fout : 1));
};

const SAFE_SHORT = SAFE;

export function makeOverlay({ w, h, brand }) {
  const star = new Path2D(brand.star.d);
  const [vx, vy, vs] = brand.star.viewBox;
  const drawStar = (ctx, cx, cy, size, colour) => {
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / vs, size / vs);
    ctx.translate(-vx, -vy);
    ctx.fillStyle = colour;
    ctx.fill(star);
    ctx.restore();
  };
  let vignette = null;

  function text(ctx, str, x, y, { size, family = 'EB Garamond', weight = 500, colour = IVORY, spacing = 0, align = 'left', alpha = 1 }) {
    ctx.save();
    ctx.font = `${weight} ${size}px "${family}"`;
    ctx.letterSpacing = `${spacing}px`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const width = ctx.measureText(str).width - spacing;
    const x0 = align === 'center' ? x - width / 2 : x;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = colour;
    ctx.fillText(str, x0, y);
    ctx.restore();
    return { x0, x1: x0 + width, y0: y - size * 0.78, y1: y + size * 0.24, width };
  }
  const measure = (ctx, str, size, family = 'EB Garamond', weight = 500, spacing = 0) => {
    ctx.save();
    ctx.font = `${weight} ${size}px "${family}"`;
    ctx.letterSpacing = `${spacing}px`;
    const m = ctx.measureText(str).width - spacing;
    ctx.restore();
    return m;
  };

  /** Draws the finish and the words of time t over the picture already on ctx. Returns the words shown: rows for the gate. */
  function draw(ctx, plan, t, anchors, frameIndex = 0) {
    const rows = [];
    const SAFE = plan.format === 'long' ? SAFE_LONG : SAFE_SHORT;
    const endDefault = plan.format === 'long' ? [w / 2, h * 0.44] : [(SAFE.left + SAFE.right) / 2, 560];
    // vignette (the fine grain is added by ffmpeg when the file is encoded)
    if (!vignette) {
      vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.74);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    for (const x of plan.texts) {
      if (x.role === 'signature') {
        const a = fade(t, x.from, x.to, 0.5, 0.6);
        if (a <= 0) continue;
        const size = x.size, mark = size * 0.56, gap = size * 0.3;
        const width = measure(ctx, x.lines[0], size);
        const cx = (SAFE.left + SAFE.right) / 2, y = x.y - (1 - a) * 8;
        const x0 = cx - (mark + gap + width) / 2;
        ctx.save(); ctx.globalAlpha = a; drawStar(ctx, x0 + mark / 2, y - size * 0.3, mark, GOLD); ctx.restore();
        const b = text(ctx, x.lines[0], x0 + mark + gap, y, { size, alpha: a });
        rows.push({ role: x.role, text: x.lines[0], size, opacity: +a.toFixed(3), x0: x0, x1: b.x1, y0: b.y0, y1: b.y1 });
      } else if (x.role === 'end') {
        const a = fade(t, x.from, plan.L + 1, 0.7, 0);
        if (a <= 0) continue;
        // the picture settles a little under the card
        ctx.save(); ctx.globalAlpha = 0.3 * a; ctx.fillStyle = '#05040c'; ctx.fillRect(0, 0, w, h); ctx.restore();
        const [ax, ay] = anchors?.end ? anchors.end() : endDefault;
        const size = x.size, lh = size * 1.04, mark = Math.round(size * 0.55), soon = x.soonSize;
        const blockH = mark + size * 0.34 + x.lines.length * lh + size * 0.2 + soon;
        let y = ay - blockH / 2 + (1 - a) * 10;
        ctx.save(); ctx.globalAlpha = a; drawStar(ctx, ax, y + mark / 2, mark, GOLD); ctx.restore();
        y += mark + size * 0.34;
        for (const line of x.lines) {
          y += lh;
          const b = text(ctx, line, ax, y - lh * 0.24, { size, align: 'center', alpha: a });
          rows.push({ role: 'end-title', text: line, size, opacity: +a.toFixed(3), x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
        }
        y += size * 0.2 + soon;
        const b = text(ctx, x.soon.toUpperCase(), ax, y, { size: soon, family: 'Inter Display', weight: 600, colour: GOLD, spacing: soon * 0.2, align: 'center', alpha: a });
        rows.push({ role: 'end-soon', text: x.soon, size: soon, opacity: +a.toFixed(3), x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
      } else if (x.role === 'tag') {
        // a loop's small title and badge: still on every frame (no fade, so the last frame is the first)
        const size = x.size;
        const t1 = text(ctx, x.lines[0], SAFE.left + 6, x.y, { size, weight: 500 });
        rows.push({ role: 'tag-title', text: x.lines[0], size, opacity: 1, x0: t1.x0, x1: t1.x1, y0: t1.y0, y1: t1.y1 });
        rows.push(...drawBadge(ctx, x.name, 28, x.y + 46, 1, SAFE.left));
      } else if (x.role === 'badge') {
        const a = fade(t, x.from, x.to, 0.4, 0.3);
        if (a <= 0) continue;
        rows.push(...drawBadge(ctx, x.name, x.size, x.y, a, SAFE.left));
      }
    }
    return rows;
  }
  /** The minimal badge: the star, the channel's name, a tiny heart and a tiny follow mark (bottom left, never mid-frame). */
  function drawBadge(ctx, name, size, y, a, left) {
    {
      {
        const x0 = left + 6;
        ctx.save(); ctx.globalAlpha = a; drawStar(ctx, x0 + size * 0.4, y - size * 0.32, size * 0.8, GOLD); ctx.restore();
        const b = text(ctx, name, x0 + size * 1.05, y, { size, family: 'Inter Display', weight: 600, alpha: a });
        // a tiny heart and a tiny follow mark
        ctx.save();
        ctx.globalAlpha = a;
        const hx = b.x1 + size * 0.7, hy = y - size * 0.34, r = size * 0.2;
        ctx.fillStyle = '#E8607A';
        ctx.beginPath();
        ctx.moveTo(hx, hy + r * 1.5);
        ctx.bezierCurveTo(hx - r * 2.4, hy - r * 0.2, hx - r * 1.0, hy - r * 1.9, hx, hy - r * 0.6);
        ctx.bezierCurveTo(hx + r * 1.0, hy - r * 1.9, hx + r * 2.4, hy - r * 0.2, hx, hy + r * 1.5);
        ctx.fill();
        const fx = hx + size * 1.0;
        ctx.strokeStyle = IVORY; ctx.lineWidth = Math.max(2, size * 0.08); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(fx, hy, size * 0.36, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx - size * 0.17, hy); ctx.lineTo(fx + size * 0.17, hy); ctx.moveTo(fx, hy - size * 0.17); ctx.lineTo(fx, hy + size * 0.17); ctx.stroke();
        ctx.restore();
        return [{ role: 'badge', text: name, size, opacity: +a.toFixed(3), x0, x1: fx + size * 0.4, y0: b.y0, y1: b.y1 }];
      }
    }
  }
  return { draw };
}
