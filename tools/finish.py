# On GitHub: joins the rendered parts, encodes the silent masters and the phone copies, makes the contact sheets and
# measures the Reel's loop seam. Audio is added on the laptop (the master stays private). Usage: python finish.py <parts> <out>
import glob, json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402

PARTS, OUT = sys.argv[1], sys.argv[2]
for d in ('reel', 'f16', 'f9', 'sheets'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
A = os.path.join(os.path.dirname(HERE), 'assets')


def ff(*a):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *a], check=True)


def join(fmt):
    parts = sorted(glob.glob(os.path.join(PARTS, f'{fmt}-*.mp4')), key=lambda p: int(re.findall(r'-(\d+)\.mp4$', p)[0]))
    lst = os.path.join(PARTS, f'{fmt}.txt')
    with open(lst, 'w') as f:
        for p in parts:
            f.write(f"file '{os.path.abspath(p)}'\n")
    return lst, len(parts)


X264 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-an']
info = {}
# the Reel
lst, n = join('reel')
reel = os.path.join(OUT, 'reel', 'riddle-15s-silent.mp4')
ff('-f', 'concat', '-safe', '0', '-i', lst, *X264, '-preset', 'slow', '-crf', '16', '-maxrate', '14M', '-bufsize', '28M', '-g', '30', reel)
ff('-i', reel, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-b:v', '6M', '-maxrate', '7M', '-bufsize', '12M',
   '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', os.path.join(OUT, 'reel', 'riddle-15s-phone-silent.mp4'))
# the full video, both shapes
for fmt, name in (('f16', 'full-16x9'), ('f9', 'full-9x16')):
    lst, n = join(fmt)
    out = os.path.join(OUT, fmt, f'{name}-silent.mp4')
    ff('-f', 'concat', '-safe', '0', '-i', lst, *X264, '-preset', 'slow', '-crf', '19', '-maxrate', '7M', '-bufsize', '14M', '-g', '60', out)
    info[name] = n
pl = os.path.join(PARTS, 'pass')
src = os.path.join(OUT, 'f16', 'full-16x9-silent.mp4')
phone = os.path.join(OUT, 'f16', 'full-16x9-540p-silent.mp4')
for p in (1, 2):
    ff('-i', src, '-vf', 'scale=960:540:flags=lanczos', '-c:v', 'libx264', '-b:v', '930k', '-maxrate', '1400k', '-bufsize', '2800k',
       '-preset', 'slow', '-pass', str(p), '-passlogfile', pl, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
       *(['-f', 'mp4', '/dev/null'] if p == 1 else [phone]))


# contact sheets
def grab(video, t, w):
    png = os.path.join(PARTS, '_g.png')
    ff('-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', f'scale={w}:-2', png)
    return Image.open(png).convert('RGB')


def sheet(video, moments, cols, w, out, title):
    ims = [(grab(video, t, w), lab) for t, lab in moments]
    h = ims[0][0].height
    rows = (len(ims) + cols - 1) // cols
    lab_h = 30
    S = Image.new('RGB', (cols * w + (cols + 1) * 8, 50 + rows * (h + lab_h + 8)), (12, 12, 22))
    d = ImageDraw.Draw(S)
    f = ImageFont.truetype(os.path.join(A, 'InterDisplay-SemiBold.ttf'), 18)
    d.text((10, 14), title, font=ImageFont.truetype(os.path.join(A, 'InterDisplay-SemiBold.ttf'), 22), fill=(244, 195, 90))
    for k, (im, lab) in enumerate(ims):
        x, y = 8 + (k % cols) * (w + 8), 50 + (k // cols) * (h + lab_h + 8)
        S.paste(im, (x, y))
        d.text((x + 4, y + h + 5), lab, font=f, fill=(220, 225, 240))
    S.save(out, quality=88)


bt = C.bt
mm = lambda t: f'{int(t // 60)}:{t % 60:04.1f}'
full_m = [(.9, 'title'), (bt(3) + .9, 'bar 3 first line'), (bt(6, 3), 'bar 6'), (bt(9, 3), 'bar 9 petals done'), (bt(10, 2), 'bar 10 breath, shooting star'),
          (bt(13), 'bar 13 the map'), (bt(16, 3), 'bar 16 astrolabe'), (bt(20, 3.2), 'bar 20 chant, corners'), (bt(24), 'bar 24 build'),
          (bt(27, 2), 'bar 27 collapse'), (bt(28) + .12, 'DROP 1 +0.12'), (bt(28) + .45, 'DROP 1 +0.45'), (bt(33), 'bar 33 desert'),
          (bt(36), 'bar 36 bridge'), (bt(39), 'bar 39 forest'), (bt(42), 'bar 42 sea'), (bt(46), 'bar 46 break, falling'),
          (bt(52, 3), 'bar 52 darkest'), (bt(56), 'bar 56 rebuilding'), (bt(60, 3), 'bar 60 riser'), (bt(61, 4.2), 'bar 61 gap'),
          (bt(62) + .12, 'DROP 2 +0.12'), (bt(62) + .45, 'DROP 2 +0.45'), (bt(63, 3), 'bar 63 Setavaz'), (bt(67), 'bar 67'),
          (bt(69, 2), 'bar 69 empty bar'), (bt(72), 'bar 72'), (bt(78), 'bar 78 leaving'), (bt(83), 'bar 83 end card'), (bt(90), 'bar 90 fade')]
full_m = [(t, f'{mm(t)}  {lab}') for t, lab in full_m]
sheet(os.path.join(OUT, 'f16', 'full-16x9-silent.mp4'), full_m, 5, 384, os.path.join(OUT, 'sheets', 'full-16x9-contact.jpg'), 'Setareh Code v2, full video 16:9')
sheet(os.path.join(OUT, 'f9', 'full-9x16-silent.mp4'), full_m, 10, 216, os.path.join(OUT, 'sheets', 'full-9x16-contact.jpg'), 'Setareh Code v2, full video 9:16')
D = C.REEL_DROP
reel_m = [(0, 'frame 0 hook'), (.97, 'beat 3: 1st letter'), (1.9, 'bar 2: guess'), (2.9, 'letter 2'), (4.8, 'letter 3'), (6.6, 'letter 4'),
          (8.5, 'riser, letter 5'), (10.4, 'letter 6'), (11.0, 'gap'), (D + .1, 'DROP +0.1'), (D + .45, 'DROP +0.45, word'),
          (D + 1.2, 'star + song'), (13.6, 'hold'), (14.5, 'knot opens'), (14.967, 'last frame')]
sheet(reel, [(t, f'{t:05.2f}s  {lab}') for t, lab in reel_m], 5, 288, os.path.join(OUT, 'sheets', 'riddle-15s-contact.jpg'), 'Setareh Code v2, riddle Reel 15 s')


# the loop seam: SSIM of last frame -> first frame against a normal step
def ssim(v, t1, t2):
    a, b = os.path.join(PARTS, '_a.png'), os.path.join(PARTS, '_b.png')
    ff('-ss', f'{t1:.3f}', '-i', v, '-frames:v', '1', a)
    ff('-ss', f'{t2:.3f}', '-i', v, '-frames:v', '1', b)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-'], capture_output=True, text=True)
    return float(re.findall(r'All:([0-9.]+)', r.stderr)[-1])


info['seam_ssim_last_to_first'] = ssim(reel, 449 / 30, 0)
info['ssim_normal_step_mid'] = ssim(reel, 200 / 30, 201 / 30)
info['ssim_normal_step_end'] = ssim(reel, 447 / 30, 448 / 30)
for f in glob.glob(os.path.join(OUT, '*', '*.mp4')):
    info[os.path.basename(f)] = round(os.path.getsize(f) / 1048576, 1)
json.dump(info, open(os.path.join(OUT, 'sheets', 'finish.json'), 'w'), indent=1)
print(json.dumps(info, indent=1))
