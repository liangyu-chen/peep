# Cuts the loading-screen drawing (two hands, a finger through an OK ring) into one PNG per hand, both on the full
# canvas so they line up exactly when brought together. The page behind them is the same paper white as the drawing,
# so each hand is simply a solid cut-out: the left hand is everything left of the ring's right edge except the hole
# in the ring; the right hand is everything right of it plus its fingertip showing through the hole.
# Run from the project root: python scripts/split-hands.py <drawing.jpg>
import sys
import numpy as np
from PIL import Image, ImageDraw

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size

def poly(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return np.asarray(m) > 0

# the right hand's side of the cut: right of x 630, right of the left fingertip (x 621) where its finger runs, and
# right of the left thumb tip (x 637) just under the finger
right = poly([(630, 0), (W, 0), (W, H), (630, H), (630, 445), (637, 445), (637, 380), (621, 380), (621, 338), (615, 338), (615, 318), (630, 318)])
# its fingertip, showing through the ring
tip = poly([(540, 331), (480, 333), (459, 339), (448, 357), (449, 384), (465, 399), (500, 404), (530, 401), (540, 398)])
# the hole in the ring (traced just inside its outline): see-through on the left hand
hole = poly([(436, 328), (455, 322), (478, 318), (512, 327), (545, 336), (545, 392), (520, 402), (495, 410), (470, 418),
             (445, 420), (420, 414), (402, 402), (393, 385), (394, 366), (406, 350), (420, 338)])

rgb = np.asarray(src).copy()
rgb[np.asarray(src.convert('L')) > 232] = 255   # the paper made pure white, matching the page, so no cut edge shows against it
# only the paper inside that outline is see-through, so the ring's own ink stays put; the fingertip goes with the right hand
hole = (hole & (np.asarray(src.convert('L')) > 190)) | tip
def save(mask, name):
    Image.fromarray(np.dstack([rgb, np.where(mask, 255, 0).astype(np.uint8)])).save(name)
save(~right & ~hole, 'public/loading/hand-left.png')
save(right | tip, 'public/loading/hand-right.png')

# the bit of the right finger hidden behind the left fingertip, filled back in so the finger is whole on its own (when
# the hands meet, the left fingertip covers it again). It is made from the visible stretch of the same finger just
# right of the gap (x 644..684, clear of the left thumb tip), mirrored back and forth so the texture runs on without a seam, with each column
# stretched between the finger's edges: level with the tip at the left, rising to the knuckle at the right
gray = np.asarray(src.convert('L')).astype(np.float32)
def edge_at(x):   # centre of the finger's top and bottom ink lines in a column of the drawing
    col = gray[:, x]
    top = [y for y in range(305, 336) if col[y] < 110]; bot = [y for y in range(386, 403) if col[y] < 110]
    return (sum(top) / len(top), sum(bot) / len(bot))
GX0, GX1, SX0, SX1 = 538, 640, 644, 684   # mirrored at x 644 and 684, columns with no pencil marks, so no stroke folds back on itself
# straight lines fitted through those edges, so the copied strip's outline runs smooth instead of wobbling column to column
_xs = np.arange(SX0, SX1 + 1); _e = np.array([edge_at(x) for x in _xs])
_ft, _fb = np.polyfit(_xs, _e[:, 0], 1), np.polyfit(_xs, _e[:, 1], 1)
edges = lambda x: (np.polyval(_ft, x), np.polyval(_fb, x))
def bez(p0, p1, p2, t):
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2
X0, Y0 = GX0, 316
patch = np.zeros((96, GX1 - GX0, 4), np.float32)
for x in range(GX0, GX1):
    t = (x - GX0) / (GX1 - GX0)
    tt, tb = bez(336.8, 331.0, 324.5, t), bez(392.0, 393.0, 397.0, t)          # the target edges here
    d = (GX1 - 1 - x) % (2 * (SX1 - SX0)); sx = SX0 + (d if d < SX1 - SX0 else 2 * (SX1 - SX0) - d)
    st, sb = edges(sx)
    for y in range(int(tt) - 3, int(tb) + 4):
        sy = st + (y - tt) * (sb - st) / (tb - tt)
        y0 = int(np.floor(sy)); f = sy - y0
        v = gray[y0, sx] * (1 - f) + gray[y0 + 1, sx] * f
        v = 255.0 if v > 232 else v                                             # paper as pure white, like the rest
        patch[y - Y0, x - GX0] = (v, v, v, 255)
patch = Image.fromarray(np.clip(patch, 0, 255).astype(np.uint8))
r = Image.open('public/loading/hand-right.png'); r.alpha_composite(patch, (X0, Y0))
# wherever the right hand already has its own drawing, keep the original, so the hands meet exactly as drawn
a = np.asarray(r).copy(); keep = right | tip
a[keep] = np.dstack([rgb, np.full(rgb.shape[:2], 255, np.uint8)])[keep]
Image.fromarray(a).save('public/loading/hand-right.png')
