# Setareh Code v2 renderer: code-driven motion graphics, no video model. The approved cover's own Milky Way photo,
# the cover's 16-petal gold girih rebuilt piece by piece on the beat, the logo's four-point star, Persian type shaped
# by HarfBuzz (prep.py masks). Silent frames piped to ffmpeg; audio is laid under later (the master never leaves the laptop).
# Usage: py render.py <reel|f16|f9> <first frame> <end frame> <out.mp4>
#        py render.py <fmt> stills <t1,t2,...> <out dir>       (song seconds; for the reel, seconds of the Reel)
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402

A = os.environ.get('ASSETS', os.path.join(os.path.dirname(HERE), 'assets'))
TAU = 2 * math.pi
ENV = json.load(open(os.path.join(A, 'env.json')))
MJ = json.load(open(os.path.join(A, 'masks.json'), encoding='utf-8'))

FMT = {
    'f16': dict(W=1920, H=1080, gc=(960, 440), R=305, fa_y=905, en_y=1003, big_y=884, big_en_y=1020, fa_sz=74, en_sz=34, big_sz=104,
                sec=('right', 1840, 62), sec_sz=42, land_k=1.52),
    'f9': dict(W=1080, H=1920, gc=(540, 800), R=372, fa_y=1455, en_y=1560, big_y=1460, big_en_y=1600, fa_sz=82, en_sz=40, big_sz=128,
               sec=('center', 540, 175), sec_sz=46, land_k=1.36),
    'reel': dict(W=1080, H=1920, gc=(540, 905), R=372, fa_y=1450, en_y=1560, big_y=1440, big_en_y=1655, fa_sz=82, en_sz=34, big_sz=150,
                 sec=('center', 540, 175), sec_sz=40, land_k=1.48),
}


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def e_out(u):
    return 1 - (1 - u) ** 3


def e_in(u):
    return u ** 3


def e_back(u, s=1.7):
    u -= 1
    return u * u * ((s + 1) * u + s) + 1


def env(name, t):
    a = ENV[name]
    return a[int(clamp(round(t * C.FPS), 0, len(a) - 1))]


def kick_at(b):
    k = ENV['kick']
    return k[b] if 0 <= b < len(k) else 0.0


def fade(img, a):
    if a >= .995:
        return img
    arr = np.asarray(img).copy()
    arr[..., 3] = (arr[..., 3].astype(np.float32) * max(0.0, a)).astype(np.uint8)
    return Image.fromarray(arr)


# ------------------------------------------------------------------ sprites
def gold_rgba(mask, grad=True, col=None):
    w, h = mask.size
    if col is not None:
        c = np.broadcast_to(np.array(col, np.float32), (h, w, 3))
    else:
        t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
        c = np.broadcast_to(np.array(C.GOLD_HI, np.float32) * (1 - t) + np.array((214, 160, 62), np.float32) * t, (h, w, 3))
    return Image.fromarray(np.dstack([c, np.asarray(mask, np.float32)]).astype(np.uint8))


def with_shadow(mask, rgba, r):
    m = int(r * 2.2) + 2
    w, h = mask.size
    out = Image.new('RGBA', (w + 2 * m, h + 2 * m), (0, 0, 0, 0))
    sh = Image.new('L', out.size, 0)
    sh.paste(mask, (m, m))
    sh = sh.filter(ImageFilter.GaussianBlur(r)).point(lambda v: int(v * .78))
    out.paste(Image.new('RGBA', out.size, (3, 3, 14, 255)), (0, 0), sh)
    out.alpha_composite(rgba, (m, m))
    return out, m


class Text:
    """a text sprite with its own anchor: (cx, cy) of the ink's middle line"""
    cache = {}

    def __init__(self, img, ink_w, ink_mid, pad):
        self.img, self.ink_w, self.ink_mid, self.pad = img, ink_w, ink_mid, pad

    def draw(self, frame, cx, cy, a=1.0, scale=1.0, dy=0):
        if a <= .01:
            return
        im = self.img
        if abs(scale - 1) > .004:
            im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
        im = fade(im, a)
        frame.alpha_composite(im, (int(cx - im.width / 2), int(cy + dy - self.ink_mid * scale)))


REF_MID = None


def fa_text(text, w, size, col=None):
    k = ('fa', text, w, size, col)
    if k in Text.cache:
        return Text.cache[k]
    global REF_MID
    m = Image.open(os.path.join(A, 'masks', C.key(text, w) + '.png'))
    sc = size / MJ['size']
    m = m.resize((max(1, int(m.width * sc)), max(1, int(m.height * sc))), Image.LANCZOS)
    if REF_MID is None:
        rm = Image.open(os.path.join(A, 'masks', C.key(C.TITLE_FA, 700) + '.png'))
        bb = rm.getbbox()
        REF_MID = (bb[1] + bb[3]) / 2 / MJ['size']
    rgba = gold_rgba(m, col=col)
    img, pad = with_shadow(m, rgba, max(3, size * .11))
    t = Text(img, m.width, pad + REF_MID * size, pad)
    Text.cache[k] = t
    return t


def en_text(text, size, font='InterDisplay-Regular.ttf', track=0.0, col=C.IVORY):
    k = ('en', text, size, font, track, col)
    if k in Text.cache:
        return Text.cache[k]
    f = ImageFont.truetype(os.path.join(A, font), size)
    ws = [f.getlength(ch) for ch in text]
    tw = int(sum(ws) + track * size * (len(text) - 1)) + 4
    asc, desc = f.getmetrics()
    m = Image.new('L', (tw, asc + desc + 4), 0)
    d = ImageDraw.Draw(m)
    x = 2
    for ch, w in zip(text, ws):
        d.text((x, 2), ch, font=f, fill=255)
        x += w + track * size
    rgba = gold_rgba(m, col=col)
    img, pad = with_shadow(m, rgba, max(3, size * .16))
    bb = m.getbbox() or (0, 0, 1, 1)
    t = Text(img, tw, pad + (bb[1] + bb[3]) / 2, pad)
    Text.cache[k] = t
    return t


def line_words(text, w, size, maxw):
    words = text.split(' ')
    sp = [fa_text(x, w, size) for x in words]
    gap = size * .3
    tot = sum(s.ink_w for s in sp) + gap * (len(sp) - 1)
    if tot > maxw:
        size = int(size * maxw / tot)
        sp = [fa_text(x, w, size) for x in words]
        gap = size * .3
        tot = sum(s.ink_w for s in sp) + gap * (len(sp) - 1)
    xs, x = [], tot / 2          # right to left
    for s in sp:
        xs.append(x - s.ink_w / 2)
        x -= s.ink_w + gap
    return sp, xs


class Girih:
    def __init__(self, R):
        self.R = R
        self.L = L = int(R * 2.75) // 2 * 2
        self.c = L / 2
        petals, tips, waists, chords = C.girih(**C.G)
        self.tips = tips
        sc = R / 760
        self.lw = max(2, round(R / 760 * 5.2 * 2))
        self.pieces = {}
        for k in range(C.N):
            self.pieces[f'p{k}'] = self.sprite(petals[k], nodes=[('tip', tips[k]), ('dot', waists[k])], sc=sc)
            self.pieces[f'c{k}'] = self.sprite([chords[k]], level=.5, sc=sc)
            segs, kc = C.khatam(k)
            self.pieces[f'k{k}'] = self.sprite(segs, level=.62, sc=sc, glow=.6)
        # the ghost: every line, thin, no glow
        g = Image.new('L', (L * 2, L * 2), 0)
        d = ImageDraw.Draw(g)
        P = lambda p: ((self.c + p[0] * R) * 2, (self.c + p[1] * R) * 2)
        for k in range(C.N):
            for a, b in petals[k] + [chords[k]] + C.khatam(k)[0]:
                d.line((P(a), P(b)), fill=255, width=2)
        g = g.resize((L, L), Image.LANCZOS)
        self.ghost = gold_rgba(g.point(lambda v: int(v * .9)), col=C.GOLD_HI)
        # the logo star (upright, never rotates) with its halo, built at 2.6x for flares
        self.star_r = 150 * sc
        S = int(self.star_r * 2 * 2.6 * 1.8)
        st = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        halo(st, (S / 2, S / 2), S / 4 - 1, C.GOLD, .6)
        dd = ImageDraw.Draw(st)
        dd.polygon(C.star_poly(S / 2, S / 2, self.star_r * 2.6, .02), fill=C.GOLD + (255,))
        dd.polygon(C.star_poly(S / 2, S / 2, self.star_r * 2.6 * .39, .02), fill=(255, 248, 232, 255))
        self.star = st
        self.star_k = 2.6

    def sprite(self, segs, nodes=(), level=1.0, sc=1.0, glow=1.0):
        R, c = self.R, self.c
        pts = [p for s in segs for p in s] + [n[1] for n in nodes]
        xs, ys = [c + p[0] * R for p in pts], [c + p[1] * R for p in pts]
        m = int(R * .16) + 8
        x0, y0, x1, y1 = int(min(xs)) - m, int(min(ys)) - m, int(max(xs)) + m, int(max(ys)) + m
        w, h = x1 - x0, y1 - y0
        line = Image.new('L', (w * 2, h * 2), 0)
        d = ImageDraw.Draw(line)
        for a, b in segs:
            d.line(((c + a[0] * R - x0) * 2, (c + a[1] * R - y0) * 2, (c + b[0] * R - x0) * 2, (c + b[1] * R - y0) * 2),
                   fill=255, width=self.lw if level > .55 else max(2, self.lw * 3 // 4))
        line = line.resize((w, h), Image.LANCZOS)
        ga = line.filter(ImageFilter.GaussianBlur(max(1.5, R / 760 * 14)))
        gb = line.filter(ImageFilter.GaussianBlur(max(3, R / 760 * 40)))
        la, a1, a2 = (np.asarray(i, np.float32) / 255 for i in (line, ga, gb))
        alpha = np.clip(la + a1 * .9 * glow + a2 * .45 * glow, 0, 1) * level
        k = np.clip(la * 1.2, 0, 1)[..., None]
        col = np.array(C.GOLD, np.float32) * (1 - k * .35) + np.array(C.GOLD_HI, np.float32) * k * .35
        im = Image.fromarray(np.dstack([np.broadcast_to(col, (h, w, 3)), alpha * 255]).clip(0, 255).astype(np.uint8))
        dd = ImageDraw.Draw(im)
        for kind, p in nodes:
            q = (c + p[0] * R - x0, c + p[1] * R - y0)
            if kind == 'tip':
                halo(im, q, 34 * sc, (255, 240, 205), .55)
                dd.polygon(C.star_poly(q[0], q[1], max(5, 26 * sc), .06), fill=(255, 246, 225, 255))
            else:
                rr = max(1.6, 5.5 * sc)
                dd.ellipse((q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr), fill=C.GOLD_HI + (230,))
        cen = (np.mean([p[0] for p in pts]), np.mean([p[1] for p in pts]))
        return dict(img=im, x=x0, y=y0, cen=cen)


def halo(lay, q, r, col, k):
    R2 = int(r * 2)
    if R2 < 2:
        return
    g = np.mgrid[-R2:R2 + 1, -R2:R2 + 1].astype(np.float32)
    a = np.clip(1 - np.hypot(g[0], g[1]) / R2, 0, 1) ** 2.4 * k
    patch = Image.fromarray(np.dstack([np.full(a.shape + (3,), col, dtype=np.float32), a * 255]).astype(np.uint8))
    lay.alpha_composite(patch, (int(q[0] - R2), int(q[1] - R2)))


def radial(size, col, power=2.0):
    g = np.mgrid[0:size, 0:size].astype(np.float32) - (size - 1) / 2
    a = np.clip(1 - np.hypot(g[0], g[1]) / (size / 2), 0, 1) ** power
    return Image.fromarray(np.dstack([np.full(a.shape + (3,), col, np.float32), a * 255]).astype(np.uint8))


# ------------------------------------------------------------------ the plans (when each piece lands or leaves)
PO = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]
ALL = [f'p{k}' for k in range(16)] + [f'c{k}' for k in range(16)] + [f'k{k}' for k in range(16)]


def plan_full():
    ev = {p: [] for p in ALL}
    bt = C.bt
    for j, k in enumerate(PO):                                    # groove 1: a petal on beats 1 and 3
        ev[f'p{k}'].append((bt(2 + j // 2, 1 + 2 * (j % 2)), 'in', .34, 'out'))
    for k in range(16):                                           # a khatam star on every bar, 2..17
        ev[f'k{k}'].append((bt(2 + k), 'in', .3, 'out'))
    for j in range(16):                                           # groove 2: the inner star, a chord a beat
        ev[f'c{j}'].append((bt(11 + j // 4, 1 + j % 4), 'in', .3, 'center'))
    for i, p in enumerate(ALL):                                   # bar 27: everything falls into the star
        ev[p].append((bt(27) + (i % 16) * .015, 'out', .55, 'center'))
    for i, p in enumerate(ALL):                                   # the drop: it bursts back out
        ev[p].append((bt(28) + .3 + (i % 16) * .006, 'in', .3, 'center'))
    for j, k in enumerate(PO):                                    # the break: the knot comes undone
        ev[f'p{k}'].append((bt(44 + j // 2, 1 + 2 * (j % 2)), 'out', 1.3, 'fall'))
    for k in range(16):
        ev[f'k{k}'].append((bt(44 + k // 2, 2 + 2 * (k % 2)), 'out', 1.0, 'out'))
        ev[f'c{k}'].append((bt(52) + k * .06, 'out', 1.2, 'center'))
    for j, k in enumerate(PO):                                    # a song shows the way: a petal a beat
        ev[f'p{k}'].append((bt(54 + j // 4, 1 + j % 4), 'in', .38, 'out'))
    for j in range(16):
        ev[f'c{j}'].append((bt(58 + j // 8, 1 + (j % 8) / 2), 'in', .3, 'center'))
        ev[f'k{j}'].append((bt(58, 1) + j * C.BEAT / 2, 'in', .3, 'out'))
    for i, p in enumerate(ALL):                                   # the gap before drop 2: in, then the burst
        ev[p].append((bt(61, 3) + (i % 16) * .01, 'out', .42, 'center'))
        ev[p].append((bt(62) + .32 + (i % 16) * .006, 'in', .32, 'center'))
    for j, k in enumerate(PO):                                    # the end: a petal leaves on every bar
        ev[f'p{k}'].append((bt(77 + j), 'out', 1.6, 'out'))
    for k in range(16):
        ev[f'c{k}'].append((bt(86) + k * .12, 'out', 1.5, 'center'))
        ev[f'k{k}'].append((bt(82) + k * C.BAR / 4, 'out', 1.2, 'out'))
    return ev


def plan_reel():
    ev = {p: [] for p in ALL}
    B = C.BEAT
    D = C.REEL_DROP
    for j, k in enumerate(PO):                                    # beats 2..17: a petal locks on each beat
        ev[f'p{k}'].append(((1 + j) * B, 'in', .3, 'out'))
    for m in range(7):                                            # beats 18..24: two chords a beat
        for c in (2 * m, 2 * m + 1):
            ev[f'c{c}'].append(((17 + m) * B, 'in', .28, 'center'))
    for c in (14, 15):
        ev[f'c{c}'].append((D, 'in', .28, 'center'))
    for k in range(16):                                           # the drop: the khatam ring bursts out
        ev[f'k{k}'].append((D + .12 + k * .012, 'in', .34, 'center'))
    for i, p in enumerate(ALL):                                   # the end: the knot opens, back to frame 0
        ev[p].append((14.28 + (i % 16) * .004, 'out', .6, 'out'))
    return ev


def piece_state(evs, t):
    vis, off, flash = 0.0, (0.0, 0.0, None), 0.0
    for (tt, kind, dur, mode) in evs:
        if kind == 'in':
            if t < tt - dur:
                break
            u = clamp((t - (tt - dur)) / dur)
            if u < 1:
                e = e_out(u)
                vis, off, flash = e ** .7, (1 - e, 0, mode), 0.0
            else:
                vis, off, flash = 1.0, (0, 0, None), math.exp(-(t - tt) / .2)
        else:
            if t < tt:
                break
            u = clamp((t - tt) / dur)
            vis, off, flash = 1 - u, (e_in(u) if mode != 'fall' else u, 1, mode), 0.0
    return vis, off, flash


# ------------------------------------------------------------------ the renderer
class Render:
    def __init__(self, fmt):
        self.fmt = fmt
        self.F = F = FMT[fmt]
        self.W, self.H, self.R = F['W'], F['H'], F['R']
        self.reel = fmt == 'reel'
        bg = Image.open(os.path.join(A, 'bg.jpg')).convert('RGB')
        # the cover photo, darkened a little so the gold carries; a working copy that covers the frame at 1.16x
        if self.W > self.H:
            win = (0, 1340 - 3000 * 9 / 32, 3000, 1340 + 3000 * 9 / 32)
        else:
            win = (1500 - 3000 * 9 / 32, 0, 1500 + 3000 * 9 / 32, 3000)
        crop = bg.crop(tuple(int(v) for v in win))
        s = 1.16
        crop = crop.resize((int(self.W * s), int(self.H * s)), Image.LANCZOS)
        a = np.asarray(crop, np.float32) * .84
        self.bg = Image.fromarray(a.clip(0, 255).astype(np.uint8))
        self.g = Girih(self.R)
        self.halo = radial(int(self.R * 3.2) // 2 * 2, C.PAL['glow'], 2.2)
        self.halo_gold = radial(int(self.R * 2.6) // 2 * 2, C.GOLD, 2.6)
        self.flash_img = radial(int(min(self.W, self.H) * 1.05) // 2 * 2, (255, 214, 160), 1.8)
        self.ev = plan_reel() if self.reel else plan_full()
        rng = np.random.default_rng(1123)
        self.stars = [(x * self.W, y * self.H, .5 + 1.3 * m ** 3, ph * TAU, 1 + int(k * 3)) for x, y, m, ph, k in rng.random((170, 5))]
        # the rotation: integrated once for the whole timeline (same in every chunk)
        n = C.REEL_N if self.reel else int(math.ceil(C.DUR * C.FPS))
        self.n = n
        self.angle = np.array([self.rot(i / C.FPS) for i in range(n + 2)])

    # ---- timeline helpers
    def rot(self, t):
        bt = C.bt
        if self.reel:
            D = C.REEL_DROP
            a = 22.5 * e_in(clamp((t - (D - 2 * C.BAR)) / (2 * C.BAR)))
            a += 11.25 * e_back(clamp((t - D) / .32)) + 11.25 * e_back(clamp((t - D - C.BAR) / .32))
            return a
        a = .45 * t
        steps = list(range(23, 27)) + [b for b in range(28, 44) if b not in (35, 36)] + [b for b in range(62, 77) if b != 69]
        for b in steps:
            a += 11.25 * e_back(clamp((t - bt(b)) / .32))
        a += 45 * e_in(clamp((t - bt(60)) / (2 * C.BAR)))
        return a

    def song_t(self, i):
        return (C.REEL_T0 + i / C.FPS) if self.reel else i / C.FPS

    def section(self, t):
        b = (t - C.FD) / C.BAR + 1
        return b

    # ---- one frame
    def frame(self, i):
        F, W, H, R = self.F, self.W, self.H, self.R
        lt = i / C.FPS                        # local time (Reel seconds, or song seconds)
        t = self.song_t(i)                    # song time
        bar = (t - C.FD) / C.BAR + 1          # fractional bar number
        bi = int(math.floor(bar))
        gbeat = int(math.floor((t - C.FD) / C.BEAT + 1e-6))
        low, high = env('low', t), env('high', t)
        drop_t = C.REEL_DROP if self.reel else None
        drops = [drop_t] if self.reel else [C.bt(28), C.bt(62)]
        tt = lt if self.reel else t
        since_drop = min([tt - d for d in drops if tt >= d] or [99])
        in_drop = (62 <= bar < 77) or (28 <= bar < 44) or (self.reel and lt >= C.REEL_DROP)

        # 1. the photo: a slow breath and drift (whole cycles in the Reel so its end meets its start)
        if self.reel:
            ph = TAU * lt / (C.REEL_N / C.FPS)
            z = 1.0 + .03 * (1 - math.cos(ph)) / 2 + .018 * math.exp(-max(0, since_drop) / .5) * (since_drop < 99)
            px, py = 10 * math.sin(ph), 6 * math.sin(2 * ph)
        else:
            z = 1.0 + .06 * t / C.DUR + .02 * math.exp(-since_drop / .6) * (since_drop < 99) + .01 * low * in_drop
            px, py = 30 * math.sin(TAU * t / 90), 14 * math.sin(TAU * t / 61)
        bw, bh = self.bg.size
        cw, ch = W / z, H / z
        x0, y0 = (bw - cw) / 2 + px, (bh - ch) / 2 + py
        frame = self.bg.transform((W, H), Image.AFFINE, (cw / W, 0, x0, 0, ch / H, y0), resample=Image.BILINEAR).convert('RGBA')
        d = ImageDraw.Draw(frame, 'RGBA')

        # 2. twinkling stars, lifted by the hi-hats
        per = C.REEL_N / C.FPS if self.reel else 7.5
        for sx, sy, r, ph0, k in self.stars:
            b = .5 + .5 * math.sin(TAU * k * lt / per + ph0)
            b = b * (.55 + .7 * high)
            rr = r * (1 + .4 * high)
            d.ellipse((sx - rr, sy - rr, sx + rr, sy + rr), fill=(236, 240, 255, int(clamp(30 + 170 * b * b, 0, 255))))

        gx, gy = F['gc']
        # 3. the glow behind the knot
        if self.reel:
            hb = .22 + .25 * low * (lt > C.REEL_DROP - 3.8) + .9 * math.exp(-max(0, since_drop) / .45) * (since_drop < 99)
            if lt > 14.2:
                hb *= clamp(1 - (lt - 14.2) / .75) * .8 + .2
        else:
            hb = .18 + (.32 * low if in_drop else .14 * low) + .9 * math.exp(-since_drop / .5) * (since_drop < 99)
            if 52 <= bar < 54:
                hb *= .5
        hl = fade(self.halo, clamp(hb))
        frame.alpha_composite(hl, (int(gx - hl.width / 2), int(gy - hl.height / 2)))
        if since_drop < 1.2:
            fl = fade(self.flash_img, .55 * math.exp(-since_drop / .35))
            frame.alpha_composite(fl, (int(gx - fl.width / 2), int(gy - fl.height / 2)))

        # 4. the astrolabe ring (full video): ticks appear one by one through "the map"
        if not self.reel:
            self.astrolabe(d, t, bar, gx, gy)

        # 5. the knot: ghost + pieces on one layer, turned as a whole
        L = self.g.L
        lay = Image.new('RGBA', (L, L), (0, 0, 0, 0))
        gh = .34 if self.reel else (.24 if bar < 77 else .24 * clamp(1 - (bar - 86) / 4))
        lay.alpha_composite(fade(self.g.ghost, gh))
        ang = self.angle[min(i, len(self.angle) - 1)]
        flashes = []
        cur_k = (bi - 2) % 16 if not self.reel else -1
        for p in ALL:
            vis, (ou, odir, mode), fl = piece_state(self.ev[p], tt)
            if vis <= .01:
                continue
            pc = self.g.pieces[p]
            cx, cy = pc['cen']
            nrm = math.hypot(cx, cy) or 1
            if mode == 'out':
                dx, dy = cx / nrm * R * .75 * ou, cy / nrm * R * .75 * ou
            elif mode == 'center':
                dx, dy = -cx * R * ou, -cy * R * ou
            elif mode == 'fall':
                dx, dy = cx / nrm * R * .25 * ou, R * .9 * ou ** 1.6
            else:
                dx = dy = 0
            a = vis
            if not self.reel:
                if 52 <= bar < 54:
                    a *= .7
                if p[0] == 'k' and int(p[1:]) == cur_k and 2 <= bar < 77:
                    fl = max(fl, .8 * math.exp(-((t - C.FD) % C.BAR) / .35))
            lay.alpha_composite(fade(pc['img'], a), (int(pc['x'] + dx), int(pc['y'] + dy)))
            if fl > .05 and p[0] in 'pk':
                flashes.append((p, fl))
        lay = lay.rotate(-ang, resample=Image.BICUBIC)
        frame.alpha_composite(lay, (int(gx - L / 2), int(gy - L / 2)))
        # landing flashes at the node (in turned coordinates)
        for p, fl in flashes:
            k = int(p[1:])
            if p[0] == 'p':
                tx, ty = self.g.tips[k]
            else:
                tx, ty = C.khatam(k)[1]
            th = math.radians(ang)
            qx = gx + R * (tx * math.cos(th) - ty * math.sin(th))
            qy = gy + R * (tx * math.sin(th) + ty * math.cos(th))
            hg = fade(self.halo_gold, .75 * fl)
            s = int(R * .55)
            hg = hg.resize((s, s), Image.BILINEAR)
            frame.alpha_composite(hg, (int(qx - s / 2), int(qy - s / 2)))

        # 6. the four lands: a corner lights while its name is on screen
        self.lands(frame, d, t, bar, gx, gy, ang)

        # 7. the logo star in the middle (upright)
        ss, sa = self.star_state(lt, t, bar, since_drop, low)
        if sa > .01:
            k = self.g.star_k
            sz = int(self.g.star.width * ss / k)
            if sz > 4:
                st = fade(self.g.star.resize((sz, sz), Image.BILINEAR), sa)
                frame.alpha_composite(st, (int(gx - sz / 2), int(gy - sz / 2)))

        # 8. rings on the kick
        b0 = gbeat
        for bb in (b0, b0 - 1):
            tb = C.FD + bb * C.BEAT
            u = (t - tb) / .55
            kk = kick_at(bb)
            if 0 <= u < 1 and kk > .18 and self.ring_on(t, bar):
                rr = R * (.32 + 1.05 * e_out(u))
                al = int(clamp(kk * 1.4) * 150 * (1 - u) ** 1.5)
                col = C.GOLD_HI if bb % 2 == 0 else C.PAL['accent']
                d.ellipse((gx - rr, gy - rr, gx + rr, gy + rr), outline=col + (al,), width=2 if W < 1500 else 2)

        # 9. shooting stars: rare, on the empty bars
        for ts, side in self.shooting():
            u = (tt - ts) / .75
            if 0 <= u < 1:
                self.shoot(d, u, side)

        # 10. text
        if self.reel:
            self.text_reel(frame, d, lt)
        else:
            self.text_full(frame, t, bar)

        # 11. fades in and out of black (full video only)
        if not self.reel:
            fa = clamp(t / .5) * clamp((173.6 - t) / 3.0)
            if fa < 1:
                frame = Image.blend(Image.new('RGBA', (W, H), (3, 3, 10, 255)), frame, fa)
        return frame.convert('RGB')

    def ring_on(self, t, bar):
        if self.reel:
            return True
        return 2 <= bar < 27 or 28 <= bar < 44 or 54 <= bar < 60 or 62 <= bar < 81

    def star_state(self, lt, t, bar, since_drop, low):
        burst = math.exp(-max(0, since_drop) / .55) if since_drop < 99 else 0
        if self.reel:
            D = C.REEL_DROP
            grow = clamp((lt - 0) / D)
            ss = .8 + .25 * grow + 1.2 * burst
            sa = .55 + .4 * grow
            if D - .45 < lt < D:
                ss *= .7
            if lt >= D:
                sa = 1.0
            if lt > 14.25:
                u = clamp((lt - 14.25) / .7)
                ss = ss * (1 - u) + .8 * u
                sa = sa * (1 - u) + .55 * u
            ss *= 1 + .05 * low
            return ss, sa
        ss = .55 + .45 * clamp((bar - 1) / 8)
        if 10 <= bar < 11:
            ss *= .85
        if 18 <= bar < 27:
            ss *= 1.05 + .06 * math.exp(-((t - C.FD) % C.BEAT) / .12)
        if 27 <= bar < 28 or (61.5 <= bar < 62):
            ss *= .65
        if 60 <= bar < 61.5:
            ss *= 1 + .15 * (bar - 60)
        ss += 1.3 * burst + .06 * low
        sa = .7 + .3 * clamp((bar - 1) / 8)
        if 52 <= bar < 54:
            sa *= .8
        if bar >= 88:
            sa *= clamp(1 - (bar - 88) / 4)
        return ss, sa

    def shooting(self):
        if self.reel:
            return [(C.REEL_DROP + .05, 1)]
        return [(C.bt(10, 1.5), 1), (C.bt(27, 1.2), -1), (C.bt(69, 1.3), 1), (C.bt(52, 2), -1)]

    def shoot(self, d, u, side):
        W, H = self.W, self.H
        x0, y0 = (W * .92, H * .06) if side > 0 else (W * .08, H * .09)
        x1, y1 = (W * .48, H * .26) if side > 0 else (W * .52, H * .3)
        hx, hy = x0 + (x1 - x0) * e_out(u), y0 + (y1 - y0) * e_out(u)
        al = math.sin(math.pi * u)
        for s in range(16):
            v = max(0, e_out(u) - s * .018)
            ax, ay = x0 + (x1 - x0) * v, y0 + (y1 - y0) * v
            v2 = max(0, e_out(u) - (s + 1) * .018)
            bx, by = x0 + (x1 - x0) * v2, y0 + (y1 - y0) * v2
            d.line((ax, ay, bx, by), fill=(255, 238, 200, int(220 * al * (1 - s / 16))), width=2)
        d.ellipse((hx - 2.5, hy - 2.5, hx + 2.5, hy + 2.5), fill=(255, 250, 235, int(255 * al)))

    def astrolabe(self, d, t, bar, gx, gy):
        R = self.R
        if bar < 11:
            return
        vis = 1.0
        if 27 <= bar < 28:
            vis = clamp(1 - (bar - 27) * 2)
        elif 44 <= bar < 62:
            vis = clamp(1 - (bar - 44) / 2) if bar < 54 else clamp((bar - 58) / 2) * .6
        elif bar >= 77:
            vis = clamp(1 - (bar - 77) / 3)
        if vis <= .01:
            return
        prog = clamp((t - C.bt(11)) / (C.bt(18) - C.bt(11)))
        off = -math.radians(self.angle[min(int(t * C.FPS), len(self.angle) - 1)] * .5)
        r1, r2 = R * 1.33, R * 1.4
        al = int(95 * vis)
        d.ellipse((gx - r2, gy - r2, gx + r2, gy + r2), outline=C.GOLD + (int(al * min(1, prog * 3)),), width=1)
        nt = int(72 * prog)
        for j in range(nt):
            th = TAU * j / 72 + off
            ri = R * 1.29 if j % 6 == 0 else r1
            c, s = math.cos(th), math.sin(th)
            d.line((gx + ri * c, gy + ri * s, gx + r2 * c, gy + r2 * s), fill=C.GOLD_HI + (al if j % 6 == 0 else int(al * .7),), width=1)

    def lands(self, frame, d, t, bar, gx, gy, ang):
        if self.reel:
            return
        act = []
        for L in C.LINES:
            if 'land' in L and C.bt(L['b0']) <= t < C.bt(L['b1'] + 1):
                act.append((L['land'], clamp((t - C.bt(L['b0'])) / .3) * clamp((C.bt(L['b1'] + 1) - t) / .4)))
        if C.bt(20) <= t < C.bt(23):                   # the chant: the four corners, two beats apart
            for k in range(4):
                tk = C.bt(20, 1 + 2 * k)
                if t >= tk:
                    act.append((k, .75 * math.exp(-(t - tk) / 1.2) + .25 * clamp((C.bt(23) - t) / .4)))
        th = math.radians(ang)
        R = self.R
        for k, a in act:
            if a <= .02:
                continue
            tx, ty = self.g.tips[C.LAND_PETAL[k]]
            rx, ry = tx * math.cos(th) - ty * math.sin(th), tx * math.sin(th) + ty * math.cos(th)
            hg = fade(self.halo_gold, .9 * a)
            s = int(R * .9)
            hg = hg.resize((s, s), Image.BILINEAR)
            frame.alpha_composite(hg, (int(gx + rx * R - s / 2), int(gy + ry * R - s / 2)))
            lk = self.F['land_k']
            fa = fa_text(C.LANDS[k][0], 600, int(self.F['fa_sz'] * .64))
            fa.draw(frame, gx + rx * R * lk, gy + ry * R * lk - 10, a)
            en = en_text(C.LANDS[k][1], int(self.F['en_sz'] * .62), 'InterDisplay-SemiBold.ttf', .25, C.PAL['accent'])
            en.draw(frame, gx + rx * R * lk, gy + ry * R * lk + self.F['fa_sz'] * .52, a * .9)

    # ---- the full video's words
    def text_full(self, frame, t, bar):
        F, W = self.F, self.W
        bt = C.bt
        # title card
        a = clamp((t - .4) / .5) * clamp((bt(3) - .3 - t) / .45)
        if a > .01:
            fa_text(C.TITLE_FA, 700, int(F['big_sz'] * 1.05)).draw(frame, W / 2, F['big_y'], a)
            en_text(C.TITLE_EN, int(F['en_sz'] * 1.35), 'EBGaramond-Variable.ttf', .02, C.GOLD_HI).draw(frame, W / 2, F['big_en_y'], a)
            self.sec(frame, 'ستاواز', 'SETAVAZ', a)
        # end card
        a = clamp((t - bt(81)) / .6)
        if a > .01:
            fa_text(C.END_FA, 800, int(F['big_sz'] * 1.1)).draw(frame, W / 2, F['big_y'], a)
            en_text(C.END_EN, int(F['en_sz'] * .9), 'InterDisplay-SemiBold.ttf', .5, C.GOLD_HI).draw(frame, W / 2, F['big_en_y'], a)
            a2 = clamp((t - bt(86)) / .6)
            if a2 > .01:
                y = F['gc'][1]
                fa_text(C.END_MORE, 500, int(F['fa_sz'] * .62), C.PAL['accent']).draw(frame, W / 2, y + self.R * .42, a2)
                en_text(C.END_MORE_EN, int(F['en_sz'] * .7), 'InterDisplay-Regular.ttf', .12, C.PAL['accent']).draw(frame, W / 2, y + self.R * .42 + F['fa_sz'] * .5, a2 * .85)
        # section labels
        for b0, b1, fa, en in C.SECTIONS:
            a = clamp((t - bt(b0)) / .5) * clamp((bt(b1 + 1) - .2 - t) / .5)
            if a > .01:
                self.sec(frame, fa, en, a)
        # lines
        for L in C.LINES:
            t0, t1 = bt(L['b0']), bt(L['b1'] + 1) - .12
            if not (t0 - .4 <= t < t1 + .35):
                continue
            out = clamp((t1 + .3 - t) / .3)
            big = L.get('kind') == 'big'
            if big:
                sz = F['big_sz'] if len(L['fa']) < 14 else int(F['big_sz'] * .8)
                tx = fa_text(L['fa'], 800, sz)
                if tx.ink_w > W * .86:
                    tx = fa_text(L['fa'], 800, int(sz * W * .86 / tx.ink_w))
                u = clamp((t - t0) / .3)
                a = clamp((t - t0 + .04) / .12) * out
                # a beat pulse: a small breath on each downbeat while it is up
                pb = math.exp(-((t - C.FD) % C.BAR) / .18) * .035
                tx.draw(frame, W / 2, F['big_y'], a, scale=1 + .2 * (1 - e_out(u)) + pb)
                ey = F['big_en_y']
                if L.get('sub'):
                    sa = clamp((t - bt(L['b0'], 3)) / .25) * out
                    fa_text(L['sub'], 600, int(F['fa_sz'] * .8)).draw(frame, W / 2, F['big_y'] + F['big_sz'] * .82, sa, dy=12 * (1 - sa))
                    ey = F['big_y'] + F['big_sz'] * .82 + F['fa_sz'] * .8
                ea = clamp((t - (bt(L['b0'] + 1) if L.get('sub') else t0 + C.BEAT)) / .35) * out
                en_text(L['en'], F['en_sz'], 'InterDisplay-Regular.ttf', .04, C.PAL['accent']).draw(frame, W / 2, ey, ea * .92)
            else:
                step = L.get('step', 1)
                sp, xs = line_words(L['fa'], 700, F['fa_sz'], W * .88)
                last = t0
                for j, (s, x) in enumerate(zip(sp, xs)):
                    tw = t0 + j * step * C.BEAT
                    last = tw
                    u = clamp((t - tw + .04) / .22)
                    if u <= 0:
                        continue
                    s.draw(frame, W / 2 + x, F['fa_y'], e_out(u) * out, dy=16 * (1 - e_out(u)))
                ea = clamp((t - last - C.BEAT) / .35) * out
                en_text(L['en'], F['en_sz'], 'InterDisplay-Regular.ttf', .04, C.PAL['accent']).draw(frame, W / 2, F['en_y'], ea * .92)

    def sec(self, frame, fa, en, a):
        F = self.F
        mode, x, y = F['sec']
        f = fa_text(fa, 500, F['sec_sz'], C.PAL['accent'])
        e = en_text(en, int(F['sec_sz'] * .5), 'InterDisplay-SemiBold.ttf', .38, C.PAL['accent'])
        if mode == 'right':
            f.draw(frame, x - f.ink_w / 2, y, a)
            e.draw(frame, x - e.ink_w / 2 + 2, y + F['sec_sz'] * .9, a * .8)
        else:
            f.draw(frame, x, y, a)
            e.draw(frame, x, y + F['sec_sz'] * .95, a * .8)

    # ---- the Reel's words: the hook, the six slots of the code, the reveal
    def text_reel(self, frame, d, lt):
        F, W = self.F, self.W
        D = C.REEL_DROP
        # the hook: full at frame 0, gone after the first bar; back at the very end (the loop)
        a = clamp((C.BAR - .1 - lt) / .3) + clamp((lt - 14.42) / .5)
        a = clamp(a)
        if a > .01:
            fa_text(C.HOOK[0], 700, 76).draw(frame, W / 2, 205, a)
            fa_text(C.HOOK[1], 700, 76).draw(frame, W / 2, 312, a)
            en_text(C.HOOK_EN, 38, 'InterDisplay-Regular.ttf', .02, C.PAL['accent']).draw(frame, W / 2, 398, a * .92)
        # the riddle header
        a = clamp((lt - C.BAR) / .35) * clamp((D - .1 - lt) / .25)
        if a > .01:
            fa_text(C.GUESS, 500, 60, C.PAL['accent']).draw(frame, W / 2, 235, a)
            en_text(C.GUESS_EN, 34, 'InterDisplay-Regular.ttf', .04, C.IVORY).draw(frame, W / 2, 318, a * .85)
        # after the drop: the song's own title
        a = clamp((lt - D - .35) / .4) * clamp((14.3 - lt) / .3)
        if a > .01:
            fa_text(C.TITLE_FA, 700, 70).draw(frame, W / 2, 230, a)
            en_text(C.TITLE_EN, 50, 'EBGaramond-Variable.ttf', .02, C.GOLD_HI).draw(frame, W / 2, 318, a)
        # six slots, right to left; one letter lights on beat 3 of every bar; at the drop they join into one word
        sw, gap, y = 128, 22, F['fa_y']
        tot = 6 * sw + 5 * gap
        merge = clamp((lt - D) / .35)
        back = clamp((lt - 14.45) / .45)
        slot_a = (1 - merge) + back
        for s in range(6):
            cx = W / 2 + tot / 2 - sw / 2 - s * (sw + gap)
            if slot_a > .01:
                al = int(150 * clamp(slot_a))
                d.line((cx - sw / 2 + 10, y + 70, cx + sw / 2 - 10, y + 70), fill=C.GOLD + (al,), width=3)
                for dx in (-sw / 2 + 10, sw / 2 - 10):
                    d.ellipse((cx + dx - 3, y + 67, cx + dx + 3, y + 73), fill=C.GOLD_HI + (al,))
        for k, slot in enumerate(C.CODE_ORDER):
            tl = k * C.BAR + 2 * C.BEAT
            s = slot - 1
            cx = W / 2 + tot / 2 - sw / 2 - s * (sw + gap)
            # the spark falls from the knot to the slot just before the letter lands
            u = (lt - (tl - .3)) / .3
            if 0 <= u < 1:
                sy0 = F['gc'][1] + self.R * 1.05
                hy = sy0 + (y - 30 - sy0) * e_in(u)
                hx = F['gc'][0] + (cx - F['gc'][0]) * e_in(u)
                for q in range(8):
                    v = max(0, e_in(u) - q * .05)
                    d.ellipse((F['gc'][0] + (cx - F['gc'][0]) * v - 2, sy0 + (y - 30 - sy0) * v - 2,
                               F['gc'][0] + (cx - F['gc'][0]) * v + 2, sy0 + (y - 30 - sy0) * v + 2), fill=(255, 236, 190, int(200 * (1 - q / 8))))
                d.ellipse((hx - 4, hy - 4, hx + 4, hy + 4), fill=(255, 250, 235, 255))
            if lt >= tl and merge < 1 and lt < 14.4:
                u = clamp((lt - tl) / .25)
                a = e_out(u) * (1 - merge)
                fl = math.exp(-(lt - tl) / .25)
                if fl > .05:
                    hg = fade(self.halo_gold, .8 * fl).resize((200, 200), Image.BILINEAR)
                    frame.alpha_composite(hg, (int(cx - 100), int(y - 100)))
                mx = cx + (W / 2 - cx) * e_in(merge)
                fa_text(C.CODE[s], 800, 104).draw(frame, mx, y, a, scale=1 + .3 * (1 - e_out(u)))
        # the reveal
        a = clamp((lt - D - .12) / .2) * clamp((14.32 - lt) / .3)
        if a > .01:
            u = clamp((lt - D - .12) / .35)
            pb = math.exp(-((lt) % C.BAR) / .18) * .03 if lt > D + .5 else 0
            fa_text(C.WORD, 800, F['big_sz']).draw(frame, W / 2, F['big_y'], a, scale=1 + .35 * (1 - e_out(u)) + pb)
            sa = clamp((lt - D - 2 * C.BEAT) / .25) * clamp((14.32 - lt) / .3)
            fa_text(C.WORD_SUB, 600, 66).draw(frame, W / 2, F['big_y'] + 140, sa, dy=12 * (1 - sa))
            ea = clamp((lt - D - C.BAR) / .3) * clamp((14.32 - lt) / .3)
            en_text(C.WORD_EN, 42, 'InterDisplay-Regular.ttf', .04, C.PAL['accent']).draw(frame, W / 2, F['big_y'] + 222, ea * .95)


def encode(fmt, i0, i1, out):
    r = Render(fmt)
    i1 = min(i1, r.n)
    p = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{r.W}x{r.H}',
                          '-r', str(C.FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', out],
                         stdin=subprocess.PIPE)
    import time
    t0 = time.time()
    for i in range(i0, i1):
        p.stdin.write(r.frame(i).tobytes())
        if (i - i0) % 100 == 0:
            print(fmt, i, f'{(time.time() - t0) / max(1, i - i0):.3f}s/frame', flush=True)
    p.stdin.close()
    p.wait()
    print('done', fmt, i0, i1, out)


if __name__ == '__main__':
    fmt = sys.argv[1]
    if sys.argv[2] == 'stills':
        r = Render(fmt)
        os.makedirs(sys.argv[4], exist_ok=True)
        for tx in sys.argv[3].split(','):
            i = int(round(float(tx) * C.FPS))
            r.frame(i).save(os.path.join(sys.argv[4], f'{fmt}-{float(tx):07.2f}.jpg'), quality=88)
            print('still', tx)
    else:
        encode(fmt, int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
