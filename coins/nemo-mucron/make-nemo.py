# Nemo from Mucron's own silhouette (same pose one to one). The snout grows out of the lower front of the face
# and is merged into the silhouette, so the outline runs around it without a seam.
import sys
from PIL import Image, ImageDraw
import numpy as np, cv2
S = '/tmp/claude-0/-home-user-mlb-picks/138ce183-2a73-5cf7-b2ba-d89ecb7f67f7/scratchpad/'
OUTDIR = '/home/user/mlb-picks/coins/nemo-mucron/img/'
TONGUE = '--tongue' in sys.argv
lab = np.load(S + 'mucron-lab.npy'); fig = np.load(S + 'mucron-fig.npy'); H, W = lab.shape
names = ['white', 'skin', 'brushblue', 'dark', 'red', 'hair', 'tie', 'iris']; L = {n: i for i, n in enumerate(names)}
ell = lambda k: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
op = cv2.morphologyEx(fig.astype(np.uint8), cv2.MORPH_OPEN, ell(31))
n, cc, st, _ = cv2.connectedComponentsWithStats(op, 8); body = cc == (1 + st[1:, cv2.CC_STAT_AREA].argmax())
fig = fig & cv2.dilate(body.astype(np.uint8), ell(35)).astype(bool)
n, cc, st, _ = cv2.connectedComponentsWithStats(fig.astype(np.uint8), 8); fig = cc == (1 + st[1:, cv2.CC_STAT_AREA].argmax())
rows, cols = np.arange(H)[:, None], np.arange(W)[None, :]
FUR, LINE, OUT = (29, 29, 33), (80, 80, 92), (6, 8, 10)

# --- the snout shape (smooth closed curve), joined to the face ---
def smooth(pts, n=400):
    pts = np.array(pts, float); P = []
    for i in range(len(pts)):  # Catmull-Rom through the points, closed
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % len(pts)], pts[(i + 2) % len(pts)]
        for t in np.linspace(0, 1, n // len(pts), endpoint=False):
            P.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return [tuple(map(int, p)) for p in P]
SNOUT = smooth([(1600, 800), (1760, 778), (1900, 782), (1975, 812), (1995, 870), (1960, 930), (1860, 975), (1720, 1010), (1590, 1035), (1520, 980)])
sm = Image.new('L', (W, H), 0); ImageDraw.Draw(sm).polygon(SNOUT, fill=255); snout = np.array(sm) > 0
fig2 = fig | snout
# round off the corner where the snout meets the jaw (a big closing, only around the snout)
zone = cv2.dilate(snout.astype(np.uint8), ell(121)).astype(bool)
closed = cv2.morphologyEx(fig2.astype(np.uint8), cv2.MORPH_CLOSE, ell(91)).astype(bool)
fig2 = fig2 | (closed & zone)

# --- colours ---
band_old = fig & cv2.dilate((~fig).astype(np.uint8), ell(13)).astype(bool)
band2 = fig2 & cv2.dilate((~fig2).astype(np.uint8), ell(15)).astype(bool)
near_edge2 = cv2.dilate((~fig2).astype(np.uint8), ell(41)).astype(bool)
dark = fig & (lab == L['dark']); head = rows < 1250
shirt = fig & (lab == L['white']) & (rows > 1150); eyes = fig & (lab == L['white']) & ~shirt
frown = (rows > 900) & (rows < 1035) & (cols > 1250) & (cols < 1570) & fig & (lab != L['skin'])
out = np.zeros((H, W, 4), np.uint8); out[fig2] = (*FUR, 255)
out[dark & head & ~band_old & ~frown & ~zone] = (*LINE, 255)         # forehead lines, ear line (none inside the snout area)
out[dark & band_old & ~zone] = (*OUT, 255)                           # the original outline, away from the snout
out[band2] = (*OUT, 255)                                             # and around the snout
out[eyes] = (255, 255, 255, 255); out[fig & (lab == L['iris'])] = (168, 105, 42, 255)
out[dark & head & cv2.dilate(eyes.astype(np.uint8), ell(25)).astype(bool)] = (*OUT, 255)   # eye rims
out[frown & fig2 & ~band2] = (*FUR, 255)                               # Mucron's frown leaves the cheek
img = Image.fromarray(out); d = ImageDraw.Draw(img)

# --- collar and tag ---
sy, sx = np.where(shirt); top = sy.min(); skin = fig & (lab == L['skin'])
yb = top + 10; xr = np.where(skin[yb - 60])[0]; x0, x1 = xr.min() - 20, xr.max() + 30
col = Image.new('L', (W, H), 0); ImageDraw.Draw(col).line([(x0, yb - 70), ((x0 + x1) // 2, yb + 20), (x1, yb - 40)], fill=255, width=95, joint='curve')
colm = np.array(col) > 0; a = np.array(img); a[colm & fig2] = (231, 23, 30, 255)
a[colm & ~cv2.erode(colm.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & fig2] = (*OUT, 255)
img = Image.fromarray(a); d = ImageDraw.Draw(img)
# the name on the collar, along its left (front-facing) segment
from PIL import ImageFont
import math
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf', 74)
p0, p1 = (x0, yb - 70), ((x0 + x1) // 2, yb + 20); ang = math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0]))
txt = Image.new('RGBA', (420, 140), (0, 0, 0, 0)); ImageDraw.Draw(txt).text((210, 70), 'NEMO', font=font, fill=(255, 255, 255, 255), anchor='mm', stroke_width=5, stroke_fill=OUT)
txt = txt.rotate(-ang, resample=Image.BICUBIC, expand=True)
cxn, cyn = int(p0[0] + 0.55 * (p1[0] - p0[0])), int(p0[1] + 0.55 * (p1[1] - p0[1])) + 4
img.alpha_composite(txt, (cxn - txt.width // 2, cyn - txt.height // 2))
tx, ty = (x0 + x1) // 2, yb + 95; d.ellipse((tx - 40, ty - 40, tx + 40, ty + 40), fill=(232, 195, 90, 255), outline=OUT, width=9); d.ellipse((tx - 12, ty - 12, tx + 12, ty + 12), fill=(176, 138, 42, 255))

# --- floppy ear where Mucron's hair flips ---
ear = smooth([(700, 360), (590, 430), (515, 600), (505, 800), (550, 975), (640, 1065), (735, 1040), (795, 880), (820, 660), (815, 450)])
d.polygon(ear, fill=(16, 16, 19, 255)); d.line(ear + [ear[0]], fill=(*LINE, 255), width=12, joint='curve')
d.line(smooth([(650, 500), (600, 700), (610, 900), (660, 1000), (640, 880), (630, 690)], 120)[:60], fill=(42, 42, 48, 255), width=8)

# --- snout details: stop crease, nose, mouth with Mucron's downturn, whisker dots ---
d.line(smooth([(1640, 806), (1605, 880), (1600, 960), (1625, 1015), (1640, 950), (1650, 870)], 160)[:80], fill=(*LINE, 255), width=9)
d.line([(1700, 792), (1880, 790)], fill=(52, 52, 60, 255), width=10)                               # light on the bridge
nose = smooth([(1895, 790), (1960, 780), (2003, 808), (2000, 850), (1965, 872), (1915, 866), (1888, 832)])
d.polygon(nose, fill=(4, 4, 5, 255)); d.line(nose + [nose[0]], fill=(*OUT, 255), width=8)
d.ellipse((1915, 792, 1960, 816), fill=(132, 132, 146, 255))
d.arc((1950, 830, 1990, 866), 200, 340, fill=(70, 70, 80, 255), width=6)                          # nostril
mouth = [(1975, 900), (1900, 935), (1800, 965), (1700, 985), (1640, 995)]
d.line(mouth, fill=(*OUT, 255), width=11, joint='curve')
d.line([(1640, 995), (1612, 1020)], fill=(*OUT, 255), width=11)                                    # the downturn, like Mucron's frown
for wx, wy in [(1790, 880), (1830, 872), (1870, 868), (1810, 905), (1850, 900)]:
    d.ellipse((wx - 6, wy - 6, wx + 6, wy + 6), fill=(70, 70, 80, 255))
if TONGUE:
    t = smooth([(1890, 938), (1935, 925), (1950, 965), (1925, 1000), (1895, 990)])
    d.polygon(t, fill=(244, 120, 140, 255)); d.line(t + [t[0]], fill=(*OUT, 255), width=8); d.line([(1920, 945), (1922, 985)], fill=(200, 80, 100, 255), width=5)

img = img.crop(img.getbbox()); img.save(S + 'nemo-pose-2048.png')
img.resize((img.width // 2, img.height // 2), Image.LANCZOS).save(OUTDIR + 'nemo-pose.png')
bg = Image.new('RGBA', img.size, (255, 255, 255, 255)); bg.alpha_composite(img)
bg.convert('RGB').crop((1150, 420, 2011, 1200)).save(S + 'nemo-head-prev.png')
m = Image.open(OUTDIR + 'mucron-1000.png').convert('RGBA'); dsm = Image.open(OUTDIR + 'nemo-pose.png').convert('RGBA')
dd = dsm.resize((int(dsm.width * 0.46), int(dsm.height * 0.46)), Image.LANCZOS)
sq = m.copy(); sq.alpha_composite(dd, (1000 - dd.width - 4, 1000 - dd.height + 8)); sq.convert('RGB').save(OUTDIR + 'nemo-mucron-square.png')
print('ok', img.size, dd.size)
