# Setareh Code v2 (23 Nov 2026): shared constants, the girih geometry (from player-1123/tools/cover.py) and every
# on-screen text. The song is instrumental with a wordless chant, so NO line here is a lyric: they are story titles,
# shown as titles, never as karaoke.
import hashlib, math

FPS = 30
DUR = 174.26
BPM = 127.94
BAR = 240 / BPM            # 1.87588 s
BEAT = BAR / 4
FD = 1.549                 # first downbeat (bar 1)


def bt(bar, beat=1.0):
    """song time of a bar (1-based) and beat (1-based, may be fractional)"""
    return FD + (bar - 1) * BAR + (beat - 1) * BEAT


GOLD, GOLD_HI, IVORY = (244, 195, 90), (255, 226, 150), (246, 236, 211)
# the approved cover's palette (setavaz.ahura.cloud/art/index.json, setareh-code)
PAL = dict(deep=(6, 7, 17), mid=(32, 36, 60), glow=(109, 129, 210), blue=(103, 114, 230), coral=(247, 94, 107),
           gold=(244, 195, 90), accent=(169, 200, 255))

# the cover's girih for this song: 16 petals, a {16/7} star inside, a ring of 16 khatam stars
N = 16
G = dict(r0=.34, r1=.6, r2=.86, d=.34)


def girih(n=N, r0=.34, r1=.6, r2=.86, d=.34):
    a = 2 * math.pi / n
    d *= a
    pol = lambda r, th: (r * math.cos(th), r * math.sin(th))
    petals, tips, waists, chords = [], [], [], []
    for k in range(n):
        th = k * a - math.pi / 2
        P0, A, B, T, C, D = pol(r0, th), pol(r1, th - a / 2), pol(r2, th - d), pol(1, th), pol(r2, th + d), pol(r1, th + a / 2)
        petals.append([(T, C), (C, D), (D, P0), (P0, A), (A, B), (B, T)])
        tips.append(T)
        waists.append(D)
    s = max(1, n // 2 - 1)
    rr = r0 * .98
    for k in range(n):
        chords.append((pol(rr, k * a - math.pi / 2), pol(rr, (k + s) * a - math.pi / 2)))
    return petals, tips, waists, chords


def khatam(i, rr=.045, ring=1.16):
    th = 2 * math.pi * i / 16 - math.pi / 2
    cx, cy = ring * math.cos(th), ring * math.sin(th)
    pts = [(cx + (rr if j % 2 == 0 else rr * .45) * math.cos(math.pi * j / 8 + th),
            cy + (rr if j % 2 == 0 else rr * .45) * math.sin(math.pi * j / 8 + th)) for j in range(16)]
    return [(pts[j], pts[(j + 1) % 16]) for j in range(16)], (cx, cy)


def star_poly(cx, cy, r, waist=0.016, steps=24):
    k = r * waist
    tips = [(0, -r), (r, 0), (0, r), (-r, 0)]
    ctl = [(-k, k), (-k, -k), (k, -k), (k, k)]
    pts = []
    for i in range(4):
        a, b, c = tips[i], tips[(i + 1) % 4], ctl[i]
        for j in range(steps):
            t = j / steps
            u = 1 - t
            pts.append((cx + u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], cy + u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]))
    return pts


def key(text, weight):
    return hashlib.md5(f'{weight}|{text}'.encode('utf-8')).hexdigest()[:12]


# ---------------- (A) the riddle Reel: bars 56..63 (the end of the break, the riser, the start of the 2nd drop) ----
REEL_BAR0 = 56
REEL_T0 = bt(REEL_BAR0)
REEL_N = 450                                   # 15.0 s at 30 fps (8 bars = 15.007 s)
REEL_DROP = bt(62) - REEL_T0                   # 11.255 s
HOOK = ['این ستاره یک پیام دارد.', 'تا آخر ببین.']
HOOK_EN = 'This star carries a message. Watch to the end.'
GUESS = 'حدس بزن: رمز ستاره چیست؟'
GUESS_EN = 'Guess the code: six letters'
CODE = ['س', 'ت', 'ا', 'و', 'ا', 'ز']           # slot 1 is the right-most (Persian reads right to left)
CODE_ORDER = [3, 6, 1, 4, 2, 5]                # which slot lights on bars 56..61 (beat 3), so it can be guessed
WORD = 'ستاواز'
WORD_SUB = 'ستاره + آواز'
WORD_EN = 'Setavaz = star + song'
TITLE_FA, TITLE_EN = 'راز ستاره', 'Setareh Code'

# ---------------- (B) the full video: story titles (not lyrics), on the song's measured sections ----------------
# kind: line = words appear one by one on the beat; big = one large phrase with a punch on the downbeat
# (b0, b1) = first and last bar (inclusive); step = beats between words
SECTIONS = [  # (first bar, last bar, Persian, English)
    (3, 9, 'ستارهٔ بی‌نام', 'THE NAMELESS STAR'),
    (11, 17, 'نقشه', 'THE MAP'),
    (18, 26, 'چهار سرزمین', 'FOUR LANDS'),
    (28, 43, 'سفر', 'THE JOURNEY'),
    (44, 61, 'شب', 'NIGHT'),
    (62, 76, 'راز', 'THE SECRET'),
]
LINES = [
    dict(b0=3, b1=5, fa='ستاره‌ای هست که نام ندارد', en='There is a star that has no name'),
    dict(b0=6, b1=9, fa='جایش روی نقشه خالی است', en='Its place on the map is empty'),
    dict(b0=10, b1=10, fa='گوش کن', en='Listen', step=1),
    dict(b0=11, b1=13, fa='یک اسطرلاب کهنه، یک گره', en='An old astrolabe, a knot'),
    dict(b0=14, b1=17, fa='گرهی با چهار گوشه', en='A knot with four corners'),
    dict(b0=18, b1=19, fa='هر گوشه، یک سرزمین', en='Each corner is a land'),
    dict(b0=20, b1=22, fa='کویر پل جنگل دریا', en='Desert, bridge, forest, sea', step=2),
    dict(b0=23, b1=24, fa='ستاره بی‌نام است', en='The star has no name'),
    dict(b0=25, b1=26, fa='تا آواز همه را جمع کند', en='so it can gather every song'),
    dict(b0=28, b1=31, fa='ستاره راه می‌افتد', en='The star sets out', kind='big'),
    dict(b0=32, b1=34, fa='از کویر', en='over the desert', kind='big', land=0),
    dict(b0=35, b1=37, fa='از پل', en='across the bridge', kind='big', land=1),
    dict(b0=38, b1=40, fa='از جنگل', en='through the forest', kind='big', land=2),
    dict(b0=41, b1=43, fa='تا دریا', en='to the sea', kind='big', land=3),
    dict(b0=44, b1=47, fa='راه دور است', en='The road is long'),
    dict(b0=48, b1=51, fa='و شب بلند', en='and the night is long'),
    dict(b0=52, b1=53, fa='تاریک‌ترین شب', en='The darkest night'),
    dict(b0=54, b1=59, fa='اما یک آواز راه را نشان می‌دهد', en='but a song shows the way'),
    dict(b0=61, b1=61, fa='حالا', en='Now', kind='big'),
    dict(b0=62, b1=65, fa='ستاواز', en='Setavaz = star + song', kind='big', sub='ستاره + آواز'),
    dict(b0=66, b1=68, fa='نامش یک آواز است', en='Its name is a song', kind='big'),
    dict(b0=70, b1=73, fa='حالا راه را بلد است', en='Now it knows the way', kind='big'),
    dict(b0=74, b1=76, fa='به سوی کویر', en='toward the desert', kind='big', land=0),
    dict(b0=77, b1=80, fa='و این، تازه آغاز است', en='and this is only the beginning'),
]
LANDS = [('کویر', 'DESERT'), ('پل', 'BRIDGE'), ('جنگل', 'FOREST'), ('دریا', 'SEA')]
LAND_PETAL = [2, 14, 10, 6]          # top-right, top-left, bottom-left, bottom-right: the journey runs right to left
END_FA, END_EN, END_MORE, END_MORE_EN = 'ستاواز', 'SETAVAZ', 'ادامه دارد', 'To be continued'


def all_fa():
    """every Persian string the renderer needs as a shaped mask: (text, weight)"""
    out = [(h, 700) for h in HOOK] + [(GUESS, 500), (WORD, 800), (WORD_SUB, 600), (TITLE_FA, 700)]
    out += [(c, 800) for c in set(CODE)]
    for s in SECTIONS:
        out.append((s[2], 500))
    for L in LINES:
        w = 800 if L.get('kind') == 'big' else 700
        out.append((L['fa'], w))
        for word in L['fa'].split(' '):
            out.append((word, w))
        if L.get('sub'):
            out.append((L['sub'], 600))
    for fa, _ in LANDS:
        out.append((fa, 600))
    out += [(END_FA, 800), (END_MORE, 500), ('ستاواز', 500)]
    return sorted(set(out))
