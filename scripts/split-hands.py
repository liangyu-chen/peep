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

# the right hand's side of the cut: right of x 630, right of the left fingertip (x 616) where its finger runs, and
# right of the left thumb tip (x 637) just under the finger
right = poly([(630, 0), (W, 0), (W, H), (630, H), (630, 445), (637, 445), (637, 380), (616, 380), (616, 318), (630, 318)])
# its fingertip, showing through the ring
tip = poly([(543, 331), (480, 333), (459, 339), (448, 357), (449, 384), (465, 399), (500, 404), (530, 401), (543, 398)])
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

# the bit of the right finger hidden behind the left fingertip, drawn back in so the finger is whole on its own
# (when the hands meet, the left fingertip covers it again): its two edges continue the original ink lines (measured
# either side: the top is level with the tip and rises to the knuckle; the underside drops a little as the finger widens), with a knuckle crease in the same scratchy style; drawn 4x up and scaled down so it's smooth
S, X0, Y0, PW, PH = 4, 536, 316, 110, 90
def bez(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (i / n for i in range(n + 1))]
top = bez((538, 336.8), (580, 330.5), (626, 327.2))
bot = bez((544, 392), (590, 393), (640, 397))
up = lambda pts: [((x - X0) * S, (y - Y0) * S) for x, y in pts]
patch = Image.new('RGBA', (PW * S, PH * S), (0, 0, 0, 0)); d = ImageDraw.Draw(patch)
d.polygon(up(top + bot[::-1]), fill=(255, 255, 255, 255))
ink = (22, 22, 22, 255)
d.line(up(top), fill=ink, width=3 * S, joint='curve'); d.line(up(bot), fill=ink, width=5 * S, joint='curve')
d.line(up(bez((584, 341), (581, 349), (585, 356))), fill=ink, width=2 * S)       # knuckle crease
d.line(up(bez((588, 372), (585, 378), (589, 385))), fill=ink, width=2 * S)
d.line(up([(568, 362), (574, 360)]), fill=(60, 60, 60, 255), width=1 * S)         # a hatch mark or two
d.line(up([(603, 350), (608, 352)]), fill=(60, 60, 60, 255), width=1 * S)
for (x0, y0, x1, y1) in [(548, 342, 566, 340), (552, 380, 572, 381), (594, 334, 612, 332), (598, 390, 616, 391), (560, 352, 563, 357)]:
    d.line(up([(x0, y0), (x1, y1)]), fill=(150, 150, 150, 255), width=1 * S)   # the faint pencil shading the rest of the finger has
patch = patch.resize((PW, PH), Image.LANCZOS)
r = Image.open('public/loading/hand-right.png'); r.alpha_composite(patch, (X0, Y0))
# wherever the right hand already has its own drawing, keep the original, so the hands meet exactly as drawn
a = np.asarray(r).copy(); keep = right | tip
a[keep] = np.dstack([rgb, np.full(rgb.shape[:2], 255, np.uint8)])[keep]
Image.fromarray(a).save('public/loading/hand-right.png')
