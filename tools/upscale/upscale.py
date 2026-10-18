# Real-ESRGAN x4plus inference (RRDBNet), CPU, weights only. usage: upscale.py model.pth in.png out.png
import sys, torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image
import numpy as np
class RDB(nn.Module):
    def __init__(s, f=64, g=32):
        super().__init__()
        s.conv1 = nn.Conv2d(f, g, 3, 1, 1); s.conv2 = nn.Conv2d(f + g, g, 3, 1, 1); s.conv3 = nn.Conv2d(f + 2 * g, g, 3, 1, 1)
        s.conv4 = nn.Conv2d(f + 3 * g, g, 3, 1, 1); s.conv5 = nn.Conv2d(f + 4 * g, f, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.l(s.conv1(x)); x2 = s.l(s.conv2(torch.cat((x, x1), 1))); x3 = s.l(s.conv3(torch.cat((x, x1, x2), 1)))
        x4 = s.l(s.conv4(torch.cat((x, x1, x2, x3), 1))); x5 = s.conv5(torch.cat((x, x1, x2, x3, x4), 1)); return x5 * 0.2 + x
class RRDB(nn.Module):
    def __init__(s, f=64, g=32):
        super().__init__(); s.rdb1 = RDB(f, g); s.rdb2 = RDB(f, g); s.rdb3 = RDB(f, g)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x
class RRDBNet(nn.Module):
    def __init__(s, f=64, nb=23, g=32):
        super().__init__()
        s.conv_first = nn.Conv2d(3, f, 3, 1, 1); s.body = nn.Sequential(*[RRDB(f, g) for _ in range(nb)]); s.conv_body = nn.Conv2d(f, f, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(f, f, 3, 1, 1); s.conv_up2 = nn.Conv2d(f, f, 3, 1, 1); s.conv_hr = nn.Conv2d(f, f, 3, 1, 1); s.conv_last = nn.Conv2d(f, 3, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        feat = s.conv_first(x); feat = feat + s.conv_body(s.body(feat))
        feat = s.l(s.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest"))); feat = s.l(s.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return s.conv_last(s.l(s.conv_hr(feat)))
sd = torch.load(sys.argv[1], map_location="cpu", weights_only=True); sd = sd.get("params_ema", sd)
# the block count comes from the weights: 23 for x4plus (photos), 6 for x4plus_anime_6B (flat art, logos, cartoons)
nb = 1 + max(int(k.split(".")[1]) for k in sd if k.startswith("body."))
m = RRDBNet(nb=nb); m.load_state_dict(sd, strict=True); m.eval()
torch.set_num_threads(max(1, torch.get_num_threads()))
img = np.asarray(Image.open(sys.argv[2]).convert("RGB"), dtype=np.float32) / 255.0
x = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0)
with torch.inference_mode(): y = m(x).clamp(0, 1)
Image.fromarray((y[0].permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)).save(sys.argv[3])
print("ok", sys.argv[3], y.shape[-1], "x", y.shape[-2])
