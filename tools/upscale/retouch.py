# removes a small badge: fills a box with a Coons-patch blend of its border pixels, feathered edges. usage: retouch.py in out x0 y0 x1 y1
import sys, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]; x0, y0, x1, y1 = map(int, sys.argv[3:7])
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
top, bot, lef, rig = im[y0, x0:x1 + 1], im[y1, x0:x1 + 1], im[y0:y1 + 1, x0], im[y0:y1 + 1, x1]
H, W = y1 - y0 + 1, x1 - x0 + 1
u = np.linspace(0, 1, W)[None, :, None]; v = np.linspace(0, 1, H)[:, None, None]
patch = (1 - v) * top[None] + v * bot[None] + (1 - u) * lef[:, None] + u * rig[:, None] \
  - ((1 - u) * (1 - v) * im[y0, x0] + u * (1 - v) * im[y0, x1] + (1 - u) * v * im[y1, x0] + u * v * im[y1, x1])
res = im.copy(); res[y0:y1 + 1, x0:x1 + 1] = patch
# feather: blend the patched box in with a soft mask so no seam shows
mask = np.zeros(im.shape[:2], np.float32); mask[y0 + 3:y1 - 2, x0 + 3:x1 - 2] = 1
mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255
final = im * (1 - mask) + res * mask
Image.fromarray(final.clip(0, 255).astype(np.uint8)).save(out); print("ok")
