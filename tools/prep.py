# Local, light: (1) static Vazirmatn weights from the variable font, (2) every Persian string as a shaped mask
# (HarfBuzz + FriBidi inside ffmpeg's drawtext, never PIL without raqm), (3) the song's beat and band envelopes.
# Out: v2/assets/ (fonts, masks/*.png, masks.json, env.json, bg.jpg). Usage: py -I tools\prep.py
import json, os, shutil, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402

V2 = os.path.dirname(HERE)
SET = os.path.abspath(os.path.join(V2, '..', '..', '..'))
A = os.path.join(V2, 'assets')
M = os.path.join(A, 'masks')
os.makedirs(M, exist_ok=True)
FONTS = os.path.join(SET, 'brand', 'fonts')
FLAC = os.path.join(SET, 'single-setareh-code', 'setareh-code.flac')

# 1. fonts
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
for w in (500, 600, 700, 800):
    out = os.path.join(A, f'Vazirmatn-{w}.ttf')
    if not os.path.exists(out):
        f = TTFont(os.path.join(FONTS, 'Vazirmatn-Variable.ttf'))
        instancer.instantiateVariableFont(f, {'wght': w}, inplace=True)
        f.save(out)
for f in ('EBGaramond-Variable.ttf', 'InterDisplay-Regular.ttf', 'InterDisplay-SemiBold.ttf'):
    shutil.copy(os.path.join(FONTS, f), os.path.join(A, f))
bg = os.path.join(SET, 'player-1123', 'art', 'layers', 'setareh-code-bg.jpg')
shutil.copy(bg, os.path.join(A, 'bg.jpg'))

# 2. masks: size 200 px, fixed vertical band (same baseline for every word), cropped left and right only
SZ, HB, Y0 = 200, 420, 90
index = {}
tmp = os.path.join(A, '_t.txt')
for text, w in C.all_fa():
    k = C.key(text, w)
    png = os.path.join(M, k + '.png')
    if not os.path.exists(png):
        with open(tmp, 'w', encoding='utf-8') as fo:
            fo.write('‏' + text)   # RLM: right-to-left base, so a word's own comma sits on its left
        font = os.path.join(A, f'Vazirmatn-{w}.ttf').replace('\\', '/').replace(':', '\\:')
        tf = tmp.replace('\\', '/').replace(':', '\\:')
        Wc = SZ * (len(text) + 4)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=black@0.0:s={Wc}x{HB},format=rgba',
                        '-vf', f"drawtext=fontfile='{font}':textfile='{tf}':fontsize={SZ}:fontcolor=white:x=(w-tw)/2:y={Y0}:text_shaping=1",
                        '-frames:v', '1', png], check=True)
        m = Image.open(png).split()[3]
        bb = m.getbbox()
        m.crop((bb[0], 0, bb[2], HB)).save(png)
    im = Image.open(png)
    index[k] = dict(text=text, w=w, size=im.size)
os.remove(tmp)
json.dump(dict(size=SZ, band=HB, masks=index), open(os.path.join(A, 'masks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('masks', len(index))

# 3. envelopes at the video frame rate + kick strength per beat
SR = 22050
raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', FLAC, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
n = int(np.ceil(len(x) / SR * C.FPS))
hop, win = SR / C.FPS, 2048
fr = np.fft.rfftfreq(win, 1 / SR)
lo_b, hi_b, mid_b = (fr > 30) & (fr < 140), (fr > 4000) & (fr < 10000), (fr > 350) & (fr < 2500)
hw = np.hanning(win).astype(np.float32)
low, high, mid = np.zeros(n), np.zeros(n), np.zeros(n)
for i in range(n):
    c = int(i * hop)
    seg = x[max(0, c - win // 2): c + win // 2]
    if len(seg) < win:
        seg = np.pad(seg, (0, win - len(seg)))
    s = np.abs(np.fft.rfft(seg * hw)) ** 2
    low[i], high[i], mid[i] = s[lo_b].sum(), s[hi_b].sum(), s[mid_b].sum()


def norm(v):
    d = 10 * np.log10(v + 1e-9)
    lo, hi = np.percentile(d, 8), np.percentile(d, 99)
    return np.clip((d - lo) / (hi - lo), 0, 1)


low, high, mid = norm(low), norm(high), norm(mid)
# kick per beat: low-band energy in the first 90 ms after the beat against the 120 ms before it
from numpy.fft import rfft, irfft
X = rfft(x)
f2 = np.fft.rfftfreq(len(x), 1 / SR)
X[(f2 > 120)] = 0
xl = irfft(X, len(x))
el = xl ** 2
kicks = []
nb = int((C.DUR - C.FD) / C.BEAT) + 2
for b in range(nb):
    tb = C.FD + b * C.BEAT
    i0 = int(tb * SR)
    a = el[i0: i0 + int(.09 * SR)].mean() if i0 < len(el) else 0
    p = el[max(0, i0 - int(.12 * SR)): i0].mean() if i0 > 0 else 0
    kicks.append(float(a))
k = np.array(kicks)
k = 10 * np.log10(k + 1e-12)
k = np.clip((k - np.percentile(k, 10)) / (np.percentile(k, 98) - np.percentile(k, 10)), 0, 1)
json.dump(dict(fps=C.FPS, low=[round(float(v), 3) for v in low], high=[round(float(v), 3) for v in high],
               mid=[round(float(v), 3) for v in mid], kick=[round(float(v), 3) for v in k]),
          open(os.path.join(A, 'env.json'), 'w'))
print('env frames', n, 'beats', len(k), 'kick bars 2-9 mean', k[4:36].mean().round(2), 'bar 27', k[104:108].round(2), 'drop2', k[244:260].mean().round(2))
