import {
  faceOf, hairOf, hatOf, frameColorOf, lensOf, clothesOf, shoeOf, socksOf,
  bodyOf, buildOf, heightOf, earringsOf, earColorOf, headphonesOf, watchOf, coatInnerOf,
} from '../content/look';

const SPIDER_PAL = {
  k: '#0b0910',
  b: '#3d243c',
  B: '#63405b',
  h: '#9a7090',
  e: '#ffd23f',
  w: '#fff7d6',
  r: '#ff4f7b',
};

const color = (value, fallback) => (typeof value === 'number' ? value : fallback);
const toHex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
function tint(n, f) {
  const map = (v) => (f >= 1 ? Math.round(v + (255 - v) * (f - 1)) : Math.round(v * f));
  return toHex((map((n >> 16) & 255) << 16) | (map((n >> 8) & 255) << 8) | map(n & 255));
}

function ownerInfo(look = {}, name = '') {
  const face = faceOf(look, name);
  const hair = hairOf(look);
  const hat = hatOf(look);
  const clothes = clothesOf(look);
  const shoes = shoeOf(look);
  const socks = socksOf(look);
  const ears = earringsOf(look);
  const phones = headphonesOf(look);
  const watch = watchOf(look);
  const lens = lensOf(look);
  const frameColor = frameColorOf(look, face.glasses);
  const inner = coatInnerOf(look);
  const skin = color(look.skin, 0xe0ac80);
  const hairColor = color(look.hair, 0x24170f);
  const shirt = color(look.shirt, 0x2f6b5c);
  const pants = color(look.pants, 0x282434);
  const hatColor = color(hat.color, 0xd08a1e);
  const shoeColor = color(shoes.color, 0x1d1d1d);
  const sockColor = color(socks.color, 0xf2efe9);
  const earColor = color(earColorOf(look), 0xd9ad52);
  const phoneColor = color(phones.color, 0x1e1e22);
  const watchColor = color(watch.color, 0x4a3222);
  const dialColor = color(watch.dial, 0x16181c);
  const eyeColor = color(face.eyeColor, 0x2a1a10);
  const innerColor = color(inner.color, 0xe6dfcf);
  return {
    look, name, face, hair, hat, clothes, shoes, socks, ears, phones, watch, lens, inner,
    body: bodyOf(look), build: buildOf(look), height: heightOf(look),
    lensSolid: lens.opacity >= 0.4,
    pal: {
      k: '#0b0910',
      skin: toHex(skin), skinL: tint(skin, 1.16), skinD: tint(skin, 0.76), skinF: tint(skin, 1.35),
      hair: toHex(hairColor), hairL: tint(hairColor, 1.25), hairD: tint(hairColor, 0.66),
      shirt: toHex(shirt), shirtL: tint(shirt, 1.18), shirtD: tint(shirt, 0.72),
      inner: toHex(innerColor), innerD: tint(innerColor, 0.76),
      pants: toHex(pants), pantsL: tint(pants, 1.16), pantsD: tint(pants, 0.7),
      shoe: toHex(shoeColor), shoeL: tint(shoeColor, 1.2), shoeD: tint(shoeColor, 0.7),
      hat: toHex(hatColor), hatL: tint(hatColor, 1.18), hatD: tint(hatColor, 0.72),
      frame: toHex(frameColor), eye: toHex(eyeColor), lens: toHex(lens.color),
      sock: toHex(sockColor), sockD: tint(sockColor, 0.8),
      metal: toHex(earColor), phone: toHex(phoneColor),
      watch: toHex(watchColor), dial: toHex(dialColor),
      tie: toHex(color(look.necktieColor, 0x161618)),
    },
  };
}

const whiten = (pal) =>
  Object.fromEntries(Object.keys(pal).map((key) => [key, '#ffffff']));

function box(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function line(g, x0, y0, x1, y1, w, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  g.fillStyle = c;
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    g.fillRect(
      Math.round(x0 + (x1 - x0) * p - w / 2),
      Math.round(y0 + (y1 - y0) * p - w / 2),
      w,
      w
    );
  }
}

function makeSprite(w, h, draw, pal) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, pal);
  return canvas;
}

function drawSpider(g, P) {
  const leg = (x0, y0, x1, y1, x2, y2) => {
    line(g, x0, y0, x1, y1, 3, P.k);
    line(g, x1, y1, x2, y2, 3, P.k);
    line(g, x0, y0, x1, y1, 2, P.B);
    line(g, x1, y1, x2, y2, 2, P.B);
  };

  leg(14, 17, 8, 12, 3, 13);
  leg(13, 20, 6, 20, 1, 22);
  leg(14, 23, 9, 28, 5, 31);
  leg(16, 25, 12, 31, 8, 32);
  leg(30, 17, 36, 12, 41, 13);
  leg(31, 20, 38, 20, 43, 22);
  leg(30, 23, 35, 28, 39, 31);
  leg(28, 25, 32, 31, 36, 32);

  box(g, 21, 11, 15, 15, P.k);
  box(g, 23, 13, 11, 11, P.b);
  box(g, 25, 15, 7, 7, P.B);
  box(g, 28, 17, 2, 2, P.h);
  box(g, 27, 20, 3, 3, P.r);

  box(g, 11, 14, 11, 11, P.k);
  box(g, 12, 15, 9, 9, P.b);
  box(g, 13, 16, 7, 7, P.B);
  box(g, 14, 17, 2, 3, P.e);
  box(g, 17, 17, 2, 3, P.e);
  box(g, 14, 18, 1, 1, P.w);
  box(g, 17, 18, 1, 1, P.w);
  box(g, 15, 23, 2, 3, P.k);
  box(g, 18, 23, 2, 3, P.k);
  box(g, 15, 26, 1, 1, P.b);
  box(g, 19, 26, 1, 1, P.b);
}

function faceRow(shape, i, h) {
  if (shape === 'round') {
    if (i === 0 || i === h - 1) return [4, 4];
    if (i === 1 || i === h - 2) return [2, 2];
    if (i === 2 || i === h - 3) return [1, 1];
    return [0, 0];
  }
  if (shape === 'oval') {
    if (i === 0 || i === h - 1) return [5, 5];
    if (i === 1 || i === h - 2) return [3, 3];
    if (i === 2 || i === h - 3) return [1, 1];
    return [0, 0];
  }
  if (shape === 'heart') {
    if (i === 0) return [3, 3];
    if (i === 1) return [2, 2];
    if (i === 2) return [1, 1];
    if (i >= h - 3) return [Math.max(1, h - i - 1), Math.max(1, h - i - 1)];
    return [0, 0];
  }
  if (shape === 'long') {
    if (i === 0 || i === h - 1) return [2, 2];
    return [1, 1];
  }
  return [0, 0];
}

const SPRITE_H = 60;

function drawOwner(g, P, O) {
  // proportions taken from the 3D body (cafe/body.js): hips at 0.63 of a 1.64 figure, shoulders at 1.25, a head 0.39
  // across, so the legs run about as long as the torso, and the two thighs side by side fill the hips' width
  const cx = 22;
  const legs = { xshort: 10, short: 12, regular: 14, tall: 16, xtall: 18 }[O.height] ?? 14;
  const soleY = SPRITE_H - 1;
  const shoeH = O.shoes.style === 'boots' ? 5 : 4;
  const shoeTop = soleY - shoeH + 1;
  const legTop = shoeTop - legs;
  const torsoH = 17;
  const torsoTop = legTop - torsoH;
  const headH = O.face.faceShape === 'long' ? 13 : 12;
  const headW = O.face.faceShape === 'square' ? 18 : 16;
  const headX = cx - (headW >> 1);
  const headBottom = torsoTop - 2;
  const headTop = headBottom - headH + 1;
  const torsoW = { thin: 15, slim: 16, regular: 18, stocky: 20, heavy: 22 }[O.build] ?? 18;
  const tx = cx - (torsoW >> 1);
  const bottom = O.clothes.style === 'dress' ? 'dress' : O.clothes.bottom;
  // each leg half the hips, less a pixel of gap between them, so together they are as wide as the body above
  const legW = (torsoW - 2) >> 1;
  const lx = cx - 1 - legW;
  const rx = cx + 1;
  // the shin a pixel slimmer than the thigh on its outer side, from the knee down
  const knee = Math.round(legTop + (shoeTop - legTop) * 0.5);
  const skinBottom = bottom === 'shorts' || bottom === 'skirt' || bottom === 'dress' || bottom === 'briefs';
  const hairLen = { bald: -1, buzz: 0, mushroom: 1, azhi: 1, spiky: 0, pompadour: 0, short: 1, bob: 4, medium: 8, long: 12 }[O.hair.length] ?? 1;
  const sleeve = O.clothes.sleeve;
  const style = O.clothes.style;
  // In battle the owner stands with their back to the screen, facing the spider: no face,
  // the back of the head and the back of the clothes.
  const back = !!O.back;
  // long hair pulled back and tied (bun, ponytails) does not hang loose; half-up still does
  const tiedUp = hairLen > 1 && ['bun', 'ponytail', 'lowpony', 'twintails', 'lowtwintails'].includes(O.hair.tie);

  if (hairLen >= 0) {
    box(g, headX - 1, headTop + 1, headW + 2, 4, P.hairD);
    box(g, headX, headTop, headW, 3, P.hair);
  }
  if (hairLen > 1 && !tiedUp) {
    const hairBottom = Math.min(torsoTop + hairLen + 2, legTop - 2);
    box(g, headX - 1, headTop + 3, headW + 2, Math.max(0, hairBottom - headTop - 3), P.hairD);
    for (const side of [-1, 1]) {
      const hx2 = side < 0 ? headX - 2 : headX + headW;
      box(g, hx2, headTop + 2, 3, hairBottom - headTop - 2, P.hair);
      box(g, side < 0 ? hx2 : hx2 + 2, headTop + 2, 1, hairBottom - headTop - 2, P.hairD);
      if (O.hair.curl === 'curly') {
        for (let y = headTop + 4; y < hairBottom; y += 3) box(g, hx2 + (side < 0 ? -1 : 1), y, 1, 2, P.hair);
      }
    }
  }
  if ((O.hair.tie === 'ponytail' || O.hair.tie === 'lowpony') && !back) {
    const tailY = headTop + (O.hair.tie === 'ponytail' ? 1 : 6);
    const tailH = O.hair.tie === 'ponytail' ? 12 : 8;
    box(g, headX - 5, tailY, 3, tailH, P.hair);
    box(g, headX - 5, tailY + 2, 1, tailH - 2, P.hairD);
    box(g, headX - 4, tailY, 3, 2, P.tie);
  } else if (O.hair.tie === 'twintails' || O.hair.tie === 'lowtwintails') {
    const tailY = headTop + (O.hair.tie === 'twintails' ? 3 : 7);
    const tailH = O.hair.tie === 'twintails' ? 10 : 7;
    for (const side of [-1, 1]) {
      const hx2 = side < 0 ? headX - 5 : headX + headW + 1;
      box(g, hx2, tailY, 3, tailH, P.hair);
      box(g, hx2, tailY, 3, 2, P.tie);
    }
  } else if ((O.hair.tie === 'bun' || O.hair.tie === 'halfup') && !back) {
    const bx = O.hair.tie === 'bun' ? cx - 3 : cx - 2;
    const by = O.hair.tie === 'bun' ? headTop - 3 : headTop - 2;
    box(g, bx, by, 6, 4, P.k);
    box(g, bx + 1, by + 1, 4, 2, P.hair);
    box(g, bx + 1, by, 4, 1, P.hairL);
  }

  const legBase = skinBottom ? P.skin : P.pants;
  const legShade = skinBottom ? P.skinD : P.pantsD;
  const drawLeg = (x, side, top, bottomY, fill, shade) => {
    // side: -1 the left leg (its outer edge on the left), 1 the right
    const outer = side < 0 ? x : x + legW - 1;
    const inner = side < 0 ? x + legW - 1 : x;
    box(g, x - 1, top, legW + 2, bottomY - top, P.k);
    box(g, x, top, legW, bottomY - top, fill);
    // lit from the front-left: the inner edge and the outer edge's lower half in shade, a crease down the middle
    box(g, inner, top, 1, bottomY - top, shade);
    if (knee < bottomY) {
      const k0 = Math.max(top, knee);
      box(g, outer, k0, 1, bottomY - k0, P.k);
      box(g, side < 0 ? outer + 1 : outer - 1, k0, 1, bottomY - k0, shade);
    }
  };
  drawLeg(lx, -1, legTop, shoeTop, legBase, legShade);
  drawLeg(rx, 1, legTop, shoeTop, legBase, legShade);
  if (bottom === 'shorts' || bottom === 'briefs') {
    const hem = bottom === 'shorts' ? Math.min(6, knee - legTop) : 2;
    // the seat across both legs, then the hems
    box(g, lx - 1, legTop, rx + legW + 1 - (lx - 1), hem + 1, P.k);
    box(g, lx, legTop, rx + legW - lx, hem, P.pants);
    box(g, cx - 1, legTop + 2, 2, hem - 2, P.pantsD);
    box(g, lx, legTop + hem - 1, rx + legW - lx, 1, P.pantsD);
  } else if (!skinBottom) {
    // trousers: the seat joining the legs at the top, so they read as one garment
    box(g, cx - 1, legTop, 2, 3, P.pants);
    box(g, cx - 1, legTop + 2, 2, 1, P.pantsD);
  }
  if (bottom === 'skirt' || bottom === 'dress') {
    const skirtColor = bottom === 'dress' ? P.shirt : P.pants;
    const skirtEdge = bottom === 'dress' ? P.shirtD : P.pantsD;
    const skirtTop = legTop - 1;
    for (let i = 0; i < 7; i++) {
      const ww = torsoW - 2 + i * 2;
      box(g, cx - (ww >> 1), skirtTop + i, ww, 1, i === 6 ? skirtEdge : skirtColor);
    }
    for (const p of [-5, 0, 5]) box(g, cx + p, skirtTop + 1, 1, 5, skirtEdge);
  }
  if (O.socks.style !== 'none' && (skinBottom || O.shoes.style === 'slides')) {
    const sockH = O.socks.style === 'long' ? 5 : 2;
    for (const x of [lx, rx]) {
      box(g, x, shoeTop - sockH, legW, sockH, P.sock);
      box(g, x, shoeTop - sockH, legW, 1, P.sockD);
    }
  }
  const drawShoe = (x) => {
    const sw = legW + 1;
    const sx = x < cx ? x - 1 : x;
    if (O.shoes.style === 'slides') {
      box(g, sx, shoeTop + 1, sw, 3, P.shoeD);
      box(g, sx, shoeTop, sw, 1, P.shoe);
      box(g, sx, soleY, sw, 1, P.k);
    } else if (O.shoes.style === 'boots') {
      box(g, sx, shoeTop - 1, sw, shoeH + 1, P.shoe);
      box(g, sx, shoeTop - 1, sw, 2, P.shoeL);
      box(g, sx, soleY, sw, 1, P.shoeD);
    } else {
      box(g, sx, shoeTop, sw, shoeH, P.shoe);
      box(g, sx, shoeTop, sw, 1, P.shoeL);
      if (O.shoes.style === 'sneaker') box(g, sx + 1, shoeTop + 2, sw - 2, 1, P.shoeL);
      box(g, sx, soleY, sw, 1, P.shoeD);
    }
    box(g, sx, shoeTop, 1, shoeH, P.shoeD);
    box(g, sx + sw - 1, shoeTop, 1, shoeH, P.shoeD);
  };
  drawShoe(lx);
  drawShoe(rx);

  box(g, cx - 2, headBottom + 1, 4, torsoTop - headBottom, P.skinD);
  box(g, tx - 1, torsoTop, torsoW + 2, torsoH + 1, P.k);
  for (let i = 0; i < torsoH; i++) {
    let x0 = tx;
    let x1 = tx + torsoW;
    if (O.body === 'female' && i >= 7 && i <= 11) {
      x0 += 1;
      x1 -= 1;
    }
    box(g, x0, torsoTop + i, x1 - x0, 1, style === 'bra' ? P.skin : P.shirt);
  }
  if (style === 'crop') {
    box(g, tx + 2, legTop - 3, torsoW - 4, 3, P.skin);
    box(g, tx + 2, legTop - 1, torsoW - 4, 1, P.skinD);
  }

  const pattern = O.clothes.pattern;
  const px0 = tx + 3;
  const py0 = torsoTop + 3;
  const pW = torsoW - 6;
  const pH = (style === 'crop' ? torsoH - 6 : torsoH - 6);
  if (style !== 'bra' && style !== 'coat' && style !== 'suit' && style !== 'jacket') {
    if (pattern === 'stripe') {
      for (let y = py0 + 1; y < py0 + pH; y += 3) box(g, px0, y, pW, 1, P.shirtD);
    } else if (pattern === 'plaid') {
      for (let y = py0 + 1; y < py0 + pH; y += 3) box(g, px0, y, pW, 1, P.shirtD);
      for (let x = px0 + 2; x < px0 + pW; x += 4) box(g, x, py0, 1, pH, P.shirtD);
    } else if (pattern === 'dots') {
      for (let y = py0 + 1; y < py0 + pH; y += 3) {
        for (let x = px0 + 1; x < px0 + pW; x += 4) box(g, x, y, 1, 1, P.shirtL);
      }
    } else if (pattern === 'camo') {
      for (const [x, y, ww, hh] of [[0, 0, 4, 2], [5, 2, 4, 3], [2, 5, 5, 2], [8, 6, 3, 2]]) {
        box(g, px0 + x, py0 + y, ww, hh, P.shirtD);
      }
    } else if (pattern === 'floral') {
      for (const [x, y] of [[1, 2], [6, 1], [4, 6], [9, 5]]) {
        box(g, px0 + x, py0 + y, 1, 1, P.shirtL);
        box(g, px0 + x - 1, py0 + y, 1, 1, P.shirtD);
        box(g, px0 + x + 1, py0 + y, 1, 1, P.shirtD);
      }
    } else if (pattern.startsWith('p_') && !back) {
      const ex = cx - 2;
      const ey = torsoTop + 5;
      box(g, ex, ey, 4, 4, P.shirtL);
      box(g, ex + 1, ey + 1, 2, 2, P.shirtD);
      if (pattern === 'p_coffee') {
        box(g, ex + 1, ey + 1, 2, 1, P.inner);
        box(g, ex + 1, ey + 2, 2, 1, '#6b3f26');
        box(g, ex + 3, ey + 1, 1, 1, P.inner);
      } else if (pattern === 'p_star') {
        box(g, ex + 1, ey, 2, 4, P.inner);
        box(g, ex, ey + 1, 4, 2, P.inner);
      } else if (pattern === 'p_smile') {
        box(g, ex + 1, ey + 1, 2, 1, P.inner);
        box(g, ex, ey + 2, 1, 1, P.inner);
        box(g, ex + 3, ey + 2, 1, 1, P.inner);
      } else if (pattern === 'p_cat') {
        box(g, ex, ey, 1, 1, P.inner);
        box(g, ex + 3, ey, 1, 1, P.inner);
        box(g, ex + 1, ey + 1, 2, 2, P.inner);
      }
    }
  }

  if (back) {
    drawBackDetails();
  } else {
  box(g, cx - 2, torsoTop, 4, 2, style === 'bra' ? P.shirt : P.skinD);
  if (style === 'tee' || style === 'crop') {
    box(g, cx - 3, torsoTop, 6, 1, P.shirtD);
    box(g, tx + 2, legTop - 2, torsoW - 4, 1, P.shirtD);
  } else if (style === 'shirt') {
    box(g, cx - 3, torsoTop, 3, 1, P.shirtL);
    box(g, cx + 1, torsoTop, 3, 1, P.shirtL);
    box(g, cx, torsoTop + 2, 1, torsoH - 4, P.shirtD);
    for (let y = torsoTop + 3; y < legTop - 2; y += 4) box(g, cx - 1, y, 2, 1, P.shirtL);
  } else if (style === 'hoodie') {
    box(g, cx - 4, torsoTop - 1, 8, 3, P.shirtD);
    box(g, cx - 3, torsoTop + 1, 6, 1, P.shirt);
    box(g, tx + 3, torsoTop + 10, torsoW - 6, 1, P.shirtD);
    box(g, cx - 2, torsoTop + 2, 1, 4, P.inner);
    box(g, cx + 1, torsoTop + 2, 1, 4, P.inner);
  } else if (style === 'jacket' || style === 'coat' || style === 'suit') {
    box(g, cx - 3, torsoTop + 1, 6, torsoH - 2, P.inner);
    for (let i = 0; i < 5; i++) {
      box(g, cx - 4 + i, torsoTop + i, 1, 1, P.shirtD);
      box(g, cx + 4 - i, torsoTop + i, 1, 1, P.shirtD);
    }
    if (style === 'suit') {
      box(g, cx - 2, torsoTop + 1, 4, torsoH - 2, P.inner);
      box(g, cx - 1, torsoTop + 2, 2, 5, P.tie);
      box(g, cx, torsoTop + 7, 1, 3, P.tie);
    } else if (style === 'coat') {
      box(g, cx, torsoTop + 2, 1, torsoH - 4, P.innerD);
    }
  } else if (style === 'varsity') {
    box(g, tx + 2, legTop - 3, torsoW - 4, 2, P.inner);
    box(g, tx + 2, legTop - 3, torsoW - 4, 1, P.innerD);
    box(g, cx - 1, torsoTop + 2, 2, 1, P.inner);
    box(g, cx - 1, torsoTop + 6, 2, 1, P.inner);
  } else if (style === 'denim') {
    box(g, tx + 2, torsoTop + 1, 1, torsoH - 2, P.shirtL);
    box(g, tx + torsoW - 3, torsoTop + 1, 1, torsoH - 2, P.shirtL);
    box(g, tx + 3, torsoTop + 8, 4, 3, P.shirtL);
    box(g, tx + torsoW - 7, torsoTop + 8, 4, 3, P.shirtL);
    box(g, cx, torsoTop + 1, 1, torsoH - 2, P.shirtL);
  } else if (style === 'dress') {
    box(g, tx + 1, torsoTop + 8, torsoW - 2, 1, P.shirtD);
  } else if (style === 'bra') {
    box(g, tx + 2, torsoTop + 3, torsoW - 4, 3, P.shirt);
    box(g, cx - 4, torsoTop, 2, 4, P.shirt);
    box(g, cx + 3, torsoTop, 2, 4, P.shirt);
  }
  }

  const armW = O.build === 'stocky' || O.build === 'heavy' ? 4 : 3;
  const armTop = torsoTop + 2;
  // hanging down to the top of the thighs, as the 3D figure's do
  const armBottom = legTop + 1;
  const armH = armBottom - armTop;
  const sleeveColor = style === 'varsity' ? P.inner : P.shirt;
  const sleeveCut = sleeve === 'long' ? armH : sleeve === 'short' ? Math.max(4, Math.floor(armH * 0.45)) : 0;
  const drawArm = (x, side) => {
    if (sleeve === 'none') {
      box(g, x, armTop, armW, armH, P.skin);
    } else {
      box(g, x, armTop, armW, sleeveCut, sleeveColor);
      box(g, x, armTop + sleeveCut, armW, armH - sleeveCut, P.skin);
      box(g, x, armTop, 1, sleeveCut, sleeveColor === P.inner ? P.innerD : P.shirtD);
    }
    box(g, x + (side < 0 ? 0 : armW - 1), armTop, 1, armH, P.k);
    box(g, x, armBottom, armW, 2, P.skin);
    box(g, x, armBottom, armW, 1, P.skinD);
    if (O.watch.wrist !== 'none' && (O.watch.wrist === 'left') === (side < 0)) {
      box(g, x, armBottom - 3, armW, 1, P.watch);
      box(g, x + 1, armBottom - 3, 1, 1, P.dial);
    }
  };
  drawArm(tx - armW, -1);
  drawArm(tx + torsoW, 1);

  box(g, headX - 2, headTop + 6, 2, 3, P.skin);
  box(g, headX + headW, headTop + 6, 2, 3, P.skin);
  for (let i = 0; i < headH; i++) {
    const [a, b] = faceRow(O.face.faceShape, i, headH, headW);
    box(g, headX + a - 1, headTop + i, headW - a - b + 2, 1, P.k);
    box(g, headX + a, headTop + i, headW - a - b, 1, P.skinF);
  }
  if (back) {
    drawBackHead();
    return;
  }
  box(g, headX + 1, headTop + 8, 1, 3, P.skinD);
  box(g, headX + headW - 2, headTop + 8, 1, 3, P.skinD);

  if (hairLen >= 0) {
    if (O.hair.length === 'buzz') {
      box(g, headX + 2, headTop + 1, headW - 4, 1, P.hair);
    } else if (O.hair.length === 'mushroom') {
      box(g, headX, headTop, headW, 3, P.hair);
      box(g, headX - 1, headTop + 2, headW + 2, 1, P.hairD);
    } else if (O.hair.length === 'spiky') {
      for (let x = 0; x < 5; x++) {
        box(g, headX + 1 + x * 3, headTop - 1 + (x % 2), 2, 3, P.hair);
      }
    } else if (O.hair.length === 'pompadour') {
      box(g, headX + 1, headTop - 2, headW - 2, 3, P.hair);
      box(g, headX + 3, headTop - 3, headW - 6, 1, P.hairL);
    } else if (O.hair.length === 'azhi') {
      box(g, headX + 1, headTop, headW - 2, 2, P.hair);
      box(g, headX + 4, headTop - 1, headW - 6, 1, P.hair);
    } else {
      for (let i = 0; i < 3; i++) {
        const [a, b] = faceRow(O.face.faceShape, i, headH, headW);
        const l = Math.max(a, 1), r = Math.max(b, 1);
        box(g, headX + l, headTop + i, headW - l - r, 1, i === 2 ? P.hairD : P.hair);
      }
    }
    if (O.hair.front === 'bangs') {
      box(g, headX + 1, headTop + 2, headW - 2, 1, P.hair);
      for (let x = 0; x < 5; x++) box(g, headX + 2 + x * 3, headTop + 3, 2, 1, P.hair);
    } else if (O.hair.front === 'center') {
      box(g, headX + 1, headTop + 2, 3, 2, P.hair);
      box(g, headX + headW - 4, headTop + 2, 3, 2, P.hair);
    } else if (O.hair.front === 'side') {
      box(g, headX + 1, headTop + 2, headW - 5, 2, P.hair);
    }
  }

  const browY = headTop + 3;
  const brows = O.face.brows;
  if (brows !== 'none') {
    const thick = brows === 'thick' || brows === 'bushy' ? 2 : 1;
    if (brows === 'unibrow') {
      box(g, cx - 6, browY, 12, thick, P.hairD);
    } else {
      box(g, cx - 6, browY, 3, thick, P.hairD);
      box(g, cx + 4, browY, 3, thick, P.hairD);
      if (brows === 'angry') {
        box(g, cx - 5, browY + 1, 2, 1, P.hairD);
        box(g, cx + 4, browY + 1, 2, 1, P.hairD);
      } else if (brows === 'worried') {
        box(g, cx - 6, browY + 1, 1, 1, P.hairD);
        box(g, cx + 6, browY + 1, 1, 1, P.hairD);
      }
    }
  }

  const eyeY = headTop + 5;
  const eyeXs = [cx - 5, cx + 2];
  if (!O.lensSolid) {
    const eyes = O.face.eyes;
    const slim = ['narrow', 'sleepy', 'deadpan', 'smile'].includes(eyes);
    for (const x of eyeXs) {
      if (slim) box(g, x, eyeY + 1, 3, 1, P.eye);
      else if (eyes === 'dot') box(g, x, eyeY + 1, 2, 2, P.eye);
      else {
        box(g, x, eyeY, 3, 2, P.eye);
        box(g, x, eyeY, 1, 1, P.skinL);
      }
    }
    if (eyes === 'wink') box(g, eyeXs[1], eyeY + 1, 3, 1, P.eye);
  }

  const glasses = O.face.glasses;
  if (glasses !== 'none') {
    const lensY = headTop + 4;
    const lLens = eyeXs[0] - 1;
    const rLens = eyeXs[1] - 1;
    const shape = O.face.glassesShape;
    const frame = glasses === 'rimless' ? P.skinD : P.frame;
    const drawLens = (x) => {
      if (O.lensSolid) box(g, x + 1, lensY + 1, 3, 2, P.lens);
      if (shape === 'round' || shape === 'oval') {
        box(g, x + 1, lensY, 3, 1, frame);
        box(g, x + 1, lensY + 3, 3, 1, frame);
        box(g, x, lensY + 1, 1, 2, frame);
        box(g, x + 4, lensY + 1, 1, 2, frame);
      } else {
        box(g, x, lensY, 5, 1, frame);
        box(g, x, lensY + 3, 5, 1, frame);
        box(g, x, lensY + 1, 1, 2, frame);
        box(g, x + 4, lensY + 1, 1, 2, frame);
      }
    };
    drawLens(lLens);
    drawLens(rLens);
    box(g, lLens + 5, lensY + 1, 2, 1, frame);
    box(g, headX + 1, lensY + 1, 1, 1, frame);
    box(g, headX + headW, lensY + 1, 1, 1, frame);
  }

  box(g, cx, headTop + 8, 1, 1, P.skinD);
  box(g, cx - 1, headTop + 9, 3, 1, P.eye);

  const facial = O.face.facialHair;
  const beardColor = O.face.beard === 'light' ? P.hairD : P.hair;
  if (facial === 'stubble') {
    for (let i = 0; i < 5; i++) box(g, headX + 3 + i * 2, headTop + 9 + (i % 2), 1, 1, P.hairD);
  } else if (facial === 'mustache' || facial === 'both' || facial === 'full') {
    const my = headTop + 9;
    box(g, cx - 4, my, 3, 1, beardColor);
    box(g, cx + 2, my, 3, 1, beardColor);
    box(g, cx - 3, my + 1, 2, 1, beardColor);
    box(g, cx + 2, my + 1, 2, 1, beardColor);
  }
  if (facial === 'goatee' || facial === 'both' || facial === 'full') {
    box(g, cx - 2, headTop + 11, 4, 2, beardColor);
    box(g, cx - 1, headTop + 13, 2, 1, beardColor);
  }
  if (facial === 'full') {
    box(g, headX + 2, headTop + 9, 1, 3, beardColor);
    box(g, headX + headW - 3, headTop + 9, 1, 3, beardColor);
    box(g, headX + 3, headBottom, headW - 6, 1, beardColor);
  }
  if (O.face.blush) {
    box(g, headX + 2, headTop + 8, 2, 1, '#ff8fb0');
    box(g, headX + headW - 4, headTop + 8, 2, 1, '#ff8fb0');
  }

  function earring(side, kind) {
    if (kind === 'none') return;
    const ex = side < 0 ? headX - 2 : headX + headW + 1;
    const ey = headTop + 9;
    if (kind === 'stud') {
      box(g, ex, ey, 1, 1, P.metal);
    } else if (kind === 'hoop') {
      box(g, ex, ey, 1, 2, P.metal);
      box(g, ex, ey, 2, 1, P.metal);
    } else {
      box(g, ex, ey, 1, 3, P.metal);
      box(g, ex, ey + 2, 2, 1, P.metal);
    }
  }
  earring(-1, O.ears.left);
  earring(1, O.ears.right);

  const hat = O.hat.hat;
  const hx = headX - 1;
  const hw = headW + 2;
  const hatTop = headTop - 4;
  if (hat === 'beanie') {
    box(g, hx, hatTop + 1, hw, 5, P.k);
    box(g, hx + 1, hatTop + 1, hw - 2, 4, P.hat);
    box(g, hx + 2, hatTop, hw - 4, 1, P.hat);
    for (let x = hx + 3; x < hx + hw - 2; x += 3) box(g, x, hatTop + 1, 1, 4, P.hatD);
    box(g, hx - 1, headTop, hw + 2, 2, P.k);
    box(g, hx, headTop, hw, 2, P.hatD);
    box(g, hx, headTop, hw, 1, P.hatL);
  } else if (hat === 'cap') {
    box(g, hx + 1, hatTop + 2, hw - 2, 3, P.k);
    box(g, hx + 2, hatTop + 2, hw - 4, 2, P.hat);
    box(g, hx + 3, hatTop + 1, hw - 6, 1, P.hat);
    box(g, hx + 1, headTop + 1, hw - 1, 1, P.hatD);
    box(g, hx + hw - 3, headTop + 1, 5, 1, P.hatD);
  } else if (hat === 'bucket') {
    box(g, hx + 1, hatTop + 1, hw - 2, 4, P.k);
    box(g, hx + 2, hatTop + 1, hw - 4, 3, P.hat);
    box(g, hx - 1, headTop + 1, hw + 2, 2, P.hatD);
    box(g, hx - 1, headTop + 1, hw + 2, 1, P.hatL);
  } else if (hat === 'fedora' || hat === 'beret') {
    box(g, hx - 2, headTop + 1, hw + 4, 2, P.k);
    box(g, hx - 1, headTop + 1, hw + 2, 1, P.hatD);
    box(g, hx + 1, hatTop + 1, hw - 2, 4, P.k);
    box(g, hx + 2, hatTop + 1, hw - 4, 3, P.hat);
    if (hat === 'fedora') box(g, hx + 2, headTop - 1, hw - 4, 1, P.hatD);
    else box(g, hx + hw - 6, hatTop, 3, 1, P.hatL);
  }
  if (hat !== 'none' && O.hat.print !== 'none') {
    box(g, hx + hw - 6, hatTop + 3, 2, 2, P.shirtL);
    box(g, hx + hw - 5, hatTop + 3, 1, 1, P.inner);
  }

  if (O.phones.wear === 'head') {
    box(g, headX - 2, headTop - 2, headW + 4, 1, P.phone);
    box(g, headX - 3, headTop + 2, 2, 6, P.phone);
    box(g, headX + headW + 1, headTop + 2, 2, 6, P.phone);
  } else if (O.phones.wear === 'neck') {
    box(g, cx - 6, torsoTop - 1, 12, 1, P.phone);
    box(g, cx - 7, torsoTop - 1, 2, 3, P.phone);
    box(g, cx + 5, torsoTop - 1, 2, 3, P.phone);
  }

  // ---- back view helpers (hoisted; only called when back is set) ----
  function drawBackDetails() {
    if (style === 'bra') {
      box(g, tx + 2, torsoTop + 4, torsoW - 4, 2, P.shirt);
      box(g, cx - 5, torsoTop, 1, 5, P.shirt);
      box(g, cx + 4, torsoTop, 1, 5, P.shirt);
      return;
    }
    // collar sitting at the back of the neck
    box(g, cx - 3, torsoTop, 6, 1, P.shirtD);
    if (style === 'tee' || style === 'crop') {
      box(g, tx + 2, legTop - 2, torsoW - 4, 1, P.shirtD);
    } else if (style === 'shirt') {
      box(g, cx - 4, torsoTop, 8, 2, P.shirtL);
      box(g, tx + 2, torsoTop + 4, torsoW - 4, 1, P.shirtD);
    } else if (style === 'hoodie') {
      // the hood lies flat on the shoulders
      box(g, cx - 5, torsoTop - 1, 10, 6, P.k);
      box(g, cx - 4, torsoTop - 1, 8, 5, P.shirt);
      box(g, cx - 3, torsoTop - 1, 6, 1, P.shirtD);
      box(g, cx - 1, torsoTop + 3, 2, 1, P.shirtD);
      box(g, tx + 2, legTop - 2, torsoW - 4, 1, P.shirtD);
    } else if (style === 'jacket' || style === 'coat' || style === 'suit') {
      box(g, cx - 4, torsoTop, 8, 2, P.shirtD);
      if (style !== 'jacket') box(g, cx, legTop - 6, 1, 5, P.shirtD);
    } else if (style === 'varsity') {
      box(g, tx + 2, legTop - 3, torsoW - 4, 2, P.inner);
      box(g, tx + 2, legTop - 3, torsoW - 4, 1, P.innerD);
      box(g, cx - 4, torsoTop, 8, 1, P.inner);
    } else if (style === 'denim') {
      box(g, tx + 2, torsoTop + 1, 1, torsoH - 2, P.shirtL);
      box(g, tx + torsoW - 3, torsoTop + 1, 1, torsoH - 2, P.shirtL);
      box(g, tx + 2, torsoTop + 5, torsoW - 4, 1, P.shirtL);
    } else if (style === 'dress') {
      box(g, tx + 1, torsoTop + 8, torsoW - 2, 1, P.shirtD);
    }
  }

  function drawBackHead() {
    // the back of the head: hair over most of it, the nape showing under short cuts
    if (hairLen >= 0) {
      const napeRows = hairLen === 0 ? 3 : hairLen === 1 || tiedUp ? 2 : 0;
      const hairColor = O.hair.length === 'buzz' ? P.hairD : P.hair;
      for (let i = 0; i < headH - napeRows; i++) {
        const [a, b] = faceRow(O.face.faceShape, i, headH, headW);
        box(g, headX + a, headTop + i, headW - a - b, 1, hairColor);
      }
      if (O.hair.length !== 'buzz') {
        box(g, headX + 2, headTop, headW - 4, 1, P.hairL);
        if (napeRows) box(g, headX + 1, headTop + headH - napeRows - 1, headW - 2, 1, P.hairD);
      }
      if (O.hair.length === 'spiky') {
        for (let x = 0; x < 5; x++) box(g, headX + 1 + x * 3, headTop - 1 + (x % 2), 2, 3, P.hair);
      } else if (O.hair.length === 'pompadour') {
        box(g, headX + 1, headTop - 2, headW - 2, 3, P.hair);
      } else if (O.hair.length === 'azhi') {
        box(g, headX + 4, headTop - 1, headW - 6, 1, P.hair);
      } else if (O.hair.length === 'mushroom') {
        box(g, headX - 1, headTop + 2, headW + 2, 1, P.hairD);
      }
      if (O.hair.curl === 'curly') {
        for (let y = headTop + 2; y < headTop + headH - napeRows - 1; y += 3) {
          for (let x = headX + 2 + (y % 2) * 2; x < headX + headW - 2; x += 4) box(g, x, y, 1, 1, P.hairD);
        }
      }
    } else {
      box(g, headX + 3, headTop + 1, headW - 6, 1, P.skinL);
    }
    // long hair hangs down over the back, unless it is tied up
    if (hairLen > 1 && !tiedUp) {
      const hairBottom = Math.min(torsoTop + hairLen + 2, legTop - 2);
      box(g, headX, headBottom - 1, headW, hairBottom - headBottom + 1, P.hair);
      box(g, headX, headBottom - 1, 1, hairBottom - headBottom + 1, P.hairD);
      box(g, headX + headW - 1, headBottom - 1, 1, hairBottom - headBottom + 1, P.hairD);
      box(g, headX + 1, hairBottom, headW - 2, 1, P.hairD);
      // strands, and a ragged ends line so it reads as hair rather than a block
      for (let x = headX + 3; x < headX + headW - 2; x += 3) box(g, x, headBottom + 1, 1, hairBottom - headBottom - 1, P.hairD);
      for (let x = headX + 1; x < headX + headW - 1; x += 2) box(g, x, hairBottom + 1, 1, 1, P.hair);
      box(g, headX + 2, headBottom - 1, headW - 4, 1, P.hairL);
    }
    if (O.hair.tie === 'ponytail' || O.hair.tie === 'lowpony') {
      const tailY = headTop + (O.hair.tie === 'ponytail' ? 3 : 8);
      const tailH = O.hair.tie === 'ponytail' ? 14 : 10;
      box(g, cx - 2, tailY, 4, tailH, P.hair);
      box(g, cx - 2, tailY + 2, 1, tailH - 2, P.hairD);
      box(g, cx - 2, tailY, 4, 2, P.tie);
    }
    // glasses: only the arms show, running back over the ears
    if (O.face.glasses !== 'none') {
      const frame = O.face.glasses === 'rimless' ? P.skinD : P.frame;
      box(g, headX - 1, headTop + 5, 2, 1, frame);
      box(g, headX + headW - 1, headTop + 5, 2, 1, frame);
    }
    // from behind, the wearer's left ear is on the viewer's left
    earring(-1, O.ears.left);
    earring(1, O.ears.right);

    const hat = O.hat.hat;
    const hx = headX - 1;
    const hw = headW + 2;
    const hatTop = headTop - 4;
    if (hat === 'beanie') {
      box(g, hx, hatTop + 1, hw, 5, P.k);
      box(g, hx + 1, hatTop + 1, hw - 2, 4, P.hat);
      box(g, hx + 2, hatTop, hw - 4, 1, P.hat);
      for (let x = hx + 3; x < hx + hw - 2; x += 3) box(g, x, hatTop + 1, 1, 4, P.hatD);
      box(g, hx - 1, headTop, hw + 2, 2, P.k);
      box(g, hx, headTop, hw, 2, P.hatD);
      box(g, hx, headTop, hw, 1, P.hatL);
    } else if (hat === 'cap') {
      // seen from behind: the crown and the strap opening at the back, no brim
      box(g, hx + 1, hatTop + 2, hw - 2, 3, P.k);
      box(g, hx + 2, hatTop + 2, hw - 4, 2, P.hat);
      box(g, hx + 3, hatTop + 1, hw - 6, 1, P.hat);
      box(g, hx + 1, headTop + 1, hw - 2, 1, P.hatD);
      box(g, cx - 2, headTop + 1, 4, 1, P.hair);
      box(g, cx - 2, headTop + 2, 4, 1, P.hatD);
    } else if (hat === 'bucket') {
      box(g, hx + 1, hatTop + 1, hw - 2, 4, P.k);
      box(g, hx + 2, hatTop + 1, hw - 4, 3, P.hat);
      box(g, hx - 1, headTop + 1, hw + 2, 2, P.hatD);
      box(g, hx - 1, headTop + 1, hw + 2, 1, P.hatL);
    } else if (hat === 'fedora' || hat === 'beret') {
      box(g, hx - 2, headTop + 1, hw + 4, 2, P.k);
      box(g, hx - 1, headTop + 1, hw + 2, 1, P.hatD);
      box(g, hx + 1, hatTop + 1, hw - 2, 4, P.k);
      box(g, hx + 2, hatTop + 1, hw - 4, 3, P.hat);
      if (hat === 'fedora') box(g, hx + 2, headTop - 1, hw - 4, 1, P.hatD);
      else box(g, hx + 2, hatTop, 3, 1, P.hatL);
    }
    // 包頭: a round bun on the back of the head, up on the crown, or under a hat a low one
    // below its edge; half-up is a smaller one on the crown with the rest left down
    if (hairLen > 1 && (O.hair.tie === 'bun' || O.hair.tie === 'halfup')) {
      const big = O.hair.tie === 'bun';
      const bw = big ? 8 : 6;
      const bh = big ? 7 : 5;
      const by = hat !== 'none' ? headTop + 3 : headTop - (big ? 3 : 2);
      const bx = cx - (bw >> 1);
      box(g, bx + 1, by, bw - 2, bh, P.k);
      box(g, bx, by + 1, bw, bh - 2, P.k);
      box(g, bx + 1, by + 1, bw - 2, bh - 2, P.hair);
      box(g, bx + 2, by + 1, bw - 4, 1, P.hairL);
      box(g, bx + 1, by + bh - 2, bw - 2, 1, P.hairD);
      box(g, bx + 2, by + 2, 1, bh - 4, P.hairL);
      box(g, bx + bw - 3, by + 3, 1, bh - 5, P.hairD);
      // the wrap of hair coming up into it from the nape
      if (big) box(g, cx - 1, by + bh, 2, 2, P.hairD);
    }
    if (O.phones.wear === 'head') {
      box(g, headX - 2, headTop - 2, headW + 4, 1, P.phone);
      box(g, headX - 3, headTop + 2, 2, 6, P.phone);
      box(g, headX + headW + 1, headTop + 2, 2, 6, P.phone);
    } else if (O.phones.wear === 'neck') {
      box(g, cx - 6, torsoTop - 1, 12, 1, P.phone);
    }
  }
}

let spiderSprites = null;

function getSpiderSprites() {
  if (!spiderSprites) {
    spiderSprites = {
      sprite: makeSprite(44, 36, drawSpider, SPIDER_PAL),
      white: makeSprite(44, 36, drawSpider, whiten(SPIDER_PAL)),
    };
  }
  return spiderSprites;
}

function layout(w, h, dockPx = 0) {
  const compact = w < 860;
  const dock = dockPx > 0 ? dockPx : compact ? Math.min(h * 0.3, 240) : h * 0.34;   // the floor ends where the dock starts
  const bottom = Math.max(h * 0.3, h - dock);
  const scale = Math.max(0.62, Math.min(2.2, Math.min(w, bottom) / 470));
  return {
    w,
    h,
    bottom,
    dock,
    scale,
    enemy: { x: w * (compact ? 0.63 : 0.67), y: bottom * 0.55 },
    player: { x: w * 0.31, y: bottom * 0.96 },
  };
}

function drawRoom(ctx, w, h, t, L, { neonText = true } = {}) {
  const floorY = L.bottom;
  const wallH = floorY * 0.52;
  const backX0 = w * 0.16;
  const backX1 = w * 0.84;
  const backTop = wallH * 0.05;
  const backBottom = wallH * 0.94;
  const backW = backX1 - backX0;
  const backH = backBottom - backTop;
  const vx = w * 0.55;
  const vy = wallH * 0.47;

  const path = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
  };
  const poly = (pts, fill) => {
    path(pts);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const sidePoint = (side, depth, level) => {
    const frontX = side === 'left' ? 0 : w;
    const backX = side === 'left' ? backX0 : backX1;
    const x = frontX + (backX - frontX) * depth;
    const top = backTop * depth;
    const bottom = h + (backBottom - h) * depth;
    return { x, y: top + (bottom - top) * level };
  };
  const wallQuad = (side, t0, t1, v0, v1) => [
    sidePoint(side, t0, v0),
    sidePoint(side, t1, v0),
    sidePoint(side, t1, v1),
    sidePoint(side, t0, v1),
  ];
  const leftBox = (d0, d1, v0, v1, dx, top, face, side) => {
    const wt0 = sidePoint('left', d0, v0);
    const wt1 = sidePoint('left', d1, v0);
    const wb0 = sidePoint('left', d0, v1);
    const wb1 = sidePoint('left', d1, v1);
    const farDx = dx * 0.84;
    const rt0 = { x: wt0.x + dx, y: wt0.y };
    const rt1 = { x: wt1.x + farDx, y: wt1.y };
    const rb0 = { x: wb0.x + dx, y: wb0.y };
    const rb1 = { x: wb1.x + farDx, y: wb1.y };
    poly([wt0, wt1, rt1, rt0], top);
    poly([rt0, rt1, rb1, rb0], face);
    poly([wt0, rt0, rb0, wb0], side);
  };
  const lerp = (a, b, k) => a + (b - a) * k;

  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, w, h);

  const ceiling = '#16151a';
  poly([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: backX1, y: backTop }, { x: backX0, y: backTop }], ceiling);

  const leftWall = '#5d4f92';
  poly([{ x: 0, y: 0 }, { x: backX0, y: backTop }, { x: backX0, y: backBottom }, { x: 0, y: h }], leftWall);
  for (let i = 1; i < 8; i++) {
    const a = sidePoint('left', i / 8, 0);
    const b = sidePoint('left', i / 8, 1);
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const rightWall = '#2f4846';
  poly([{ x: w, y: 0 }, { x: backX1, y: backTop }, { x: backX1, y: backBottom }, { x: w, y: h }], rightWall);
  for (let i = 1; i < 8; i++) {
    const a = sidePoint('right', i / 8, 0);
    const b = sidePoint('right', i / 8, 1);
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const floorPts = [
    { x: backX0, y: backBottom },
    { x: backX1, y: backBottom },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const floor = '#8a8a87';
  poly(floorPts, floor);

  path(floorPts);
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 90; i++) {
    const x = (i * 149) % w;
    const y = backBottom + ((i * 233) % Math.max(1, h - backBottom));
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(35,35,37,.1)';
    ctx.fillRect(x, y, 2, 2);
  }
  for (let i = -5; i <= 5; i++) {
    ctx.strokeStyle = 'rgba(38,38,40,.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx + i * w * 0.15, h);
    ctx.stroke();
  }
  for (let i = 1; i <= 5; i++) {
    const k = Math.pow(i / 5, 1.65);
    const y = backBottom + (h - backBottom) * k;
    const kk = (y - backBottom) / Math.max(1, h - backBottom);
    const xl = backX0 * (1 - kk);
    const xr = backX1 + (w - backX1) * kk;
    ctx.strokeStyle = 'rgba(38,38,40,.045)';
    ctx.beginPath();
    ctx.moveTo(xl, y);
    ctx.lineTo(xr, y);
    ctx.stroke();
  }
  for (let c = 0; c < 3; c++) {
    let x = w * (0.24 + c * 0.24) + Math.sin(c * 2.1) * w * 0.025;
    let y = backBottom + (h - backBottom) * (0.12 + c * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += Math.sin(c * 3.7 + k * 1.3) * w * 0.018;
      y += (h - backBottom) * 0.022;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(44,42,44,${0.14 + c * 0.02})`;
    ctx.lineWidth = Math.max(1, w / 1000);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(0,0,0,.34)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(backX0, backBottom);
  ctx.lineTo(0, h);
  ctx.moveTo(backX1, backBottom);
  ctx.lineTo(w, h);
  ctx.stroke();

  const backWall = '#9a9a96';
  ctx.fillStyle = backWall;
  ctx.fillRect(backX0, backTop, backW, backH);
  for (let i = 0; i < 95; i++) {
    const x = backX0 + ((i * 137) % backW);
    const y = backTop + ((i * 211) % backH);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.14)' : 'rgba(35,35,35,.1)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(backX0, backBottom - 14, backW, 14);
  ctx.fillStyle = '#222126';
  ctx.fillRect(backX0, backBottom - 5, backW, 5);
  ctx.fillStyle = '#0c0c0e';
  ctx.fillRect(backX0, backBottom - 1, backW, 1);

  const doorX0 = backX0 + backW * 0.005;
  const doorX1 = backX0 + backW * 0.257;
  const doorY0 = backTop + backH * 0.13;
  const doorY1 = backBottom - backH * 0.03;
  const doorW = doorX1 - doorX0;
  const doorH = doorY1 - doorY0;
  ctx.fillStyle = '#111114';
  ctx.fillRect(doorX0 - 5, doorY0 - 6, doorW + 10, doorH + 8);
  ctx.fillStyle = '#2f2f34';
  ctx.fillRect(doorX0 - 2, doorY0 - 3, doorW + 4, doorH + 4);

  const doorPanel = (x0, x1, front) => {
    const pw = x1 - x0;
    ctx.fillStyle = front ? '#34373a' : '#2d3033';
    ctx.fillRect(x0, doorY0, pw, doorH);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(x0, doorY0, 1, doorH);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x1 - 1, doorY0, 1, doorH);
    ctx.fillStyle = '#23262a';
    ctx.fillRect(x0 + 3, doorY0 + 3, pw - 6, 4);
    ctx.fillRect(x0 + 3, doorY1 - 7, pw - 6, 4);
    const top = doorY0 + doorH * 0.098;
    const paneH = doorH * 0.233;
    const gap = doorH * 0.05;
    const paneW = pw * 0.73;
    for (let i = 0; i < 3; i++) {
      const y = top + i * (paneH + gap);
      const px = x0 + (pw - paneW) / 2;
      ctx.fillStyle = '#23262a';
      ctx.fillRect(px - 2, y - 2, paneW + 4, paneH + 4);
      const frost = '#6f7f7c';
      ctx.fillStyle = frost;
      ctx.fillRect(px, y, paneW, paneH);
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(px, y, paneW, 1);
      ctx.fillRect(px, y, 1, paneH);
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.fillRect(px, y + paneH - 1, paneW, 1);
      ctx.fillRect(px + paneW - 1, y, 1, paneH);
      ctx.fillStyle = 'rgba(233,244,238,.08)';
      ctx.beginPath();
      ctx.moveTo(px + paneW * 0.12, y + paneH);
      ctx.lineTo(px + paneW * 0.72, y);
      ctx.lineTo(px + paneW * 0.92, y);
      ctx.lineTo(px + paneW * 0.32, y + paneH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(x0, doorY0, 2, doorH);
    if (front) {
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(x0, doorY0, 5, doorH);
    }
  };

  const overlap = doorW * 0.025;
  const panelW = (doorW + overlap) / 2;
  doorPanel(doorX0, doorX0 + panelW, false);
  doorPanel(doorX1 - panelW, doorX1, true);

  ctx.fillStyle = '#141417';
  ctx.fillRect(doorX0 - 8, doorY0 - 8, doorW + 16, 5);
  ctx.fillStyle = '#3b3d40';
  ctx.fillRect(doorX0 - 6, doorY0 - 5, doorW + 12, 1);
  const acW = doorW * 0.79;
  const acX = doorX0 + (doorW - acW) / 2;
  const acH = backH * 0.115;
  const acBottom = doorY0 - backH * 0.03;
  const acY = acBottom - acH;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(acX + 3, acBottom, acW, 4);
  const acFace = '#e6e6e2';
  ctx.fillStyle = acFace;
  ctx.fillRect(acX, acY, acW, acH);
  ctx.fillStyle = '#fbfbf8';
  ctx.fillRect(acX, acY, acW, 3);
  ctx.fillStyle = '#83888d';
  ctx.fillRect(acX + acW * 0.06, acY + acH * 0.63, acW * 0.88, 2);
  ctx.fillStyle = '#b0b4b7';
  ctx.fillRect(acX + acW * 0.06, acY + acH * 0.78, acW * 0.88, 4);
  ctx.fillStyle = '#6f7479';
  ctx.fillRect(acX + acW * 0.08, acBottom - 2, acW * 0.84, 2);

  const brickCx = backX0 + backW * 0.66;
  const brickW = backW * 0.39;
  const brickH = backH * 0.54;
  const brickX0 = brickCx - brickW / 2;
  const brickX1 = brickCx + brickW / 2;
  const brickY0 = backTop + backH * 0.07;
  const brickY1 = brickY0 + brickH;
  const patchNorm = [
    [20, 30], [60, 8], [120, 18], [180, 4], [214, 40], [206, 96],
    [214, 132], [150, 124], [90, 136], [30, 126], [6, 90], [14, 56],
  ];
  const patchPts = patchNorm.map(([px, py]) => ({
    x: brickX0 + (brickW * px) / 220,
    y: brickY0 + (brickH * py) / 140,
  }));
  ctx.save();
  path(patchPts);
  ctx.clip();
  ctx.fillStyle = '#4a3a34';
  ctx.fillRect(brickX0, brickY0, brickW, brickH);
  const brickCols = ['#5a3d34', '#4e342d', '#63443a', '#55382f', '#6a4a3e'];
  const rows = 7;
  const cols = 10;
  const bw = brickW / cols;
  const bh = brickH / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw * 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle = brickCols[(r * 3 + c * 5 + 17) % brickCols.length];
      ctx.fillRect(brickX0 + c * bw + off + 1, brickY0 + r * bh + 1, bw - 3, bh - 2);
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(28,24,24,.5)';
  ctx.lineWidth = Math.max(1, w * 0.0015);
  path(patchPts);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const nx = brickCx;
  const ny = brickY0 + brickH * 0.44;
  const nr = Math.min(brickW * 0.22, backH * 0.17);
  ctx.save();
  ctx.strokeStyle = '#ff3a2a';
  ctx.lineWidth = Math.max(2, nr * 0.1);
  ctx.beginPath();
  ctx.arc(nx, ny, nr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (neonText) drawNeonText(ctx, nx, ny, nr);

  const shelfX0 = doorX1 + 6;
  const shelfX1 = backX1 - backW * 0.015;
  const shelfY = backTop + backH * 0.64;
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(shelfX0, shelfY, shelfX1 - shelfX0, 4);
  ctx.fillStyle = '#8a5a3c';
  ctx.fillRect(shelfX0, shelfY, shelfX1 - shelfX0, 1);
  const bookCols = ['#d8d0c0', '#f2f2f2', '#c94a3a', '#3a5fa8', '#e6c34a', '#2a2a2a'];
  let bookX = shelfX0 + 3;
  let bookI = 0;
  while (bookX < shelfX1 - 3) {
    const bookW = Math.max(3, ((shelfX1 - shelfX0) / 38) * (0.65 + ((bookI * 13) % 7) / 10));
    const bookH = backH * (0.05 + ((bookI * 7) % 4) * 0.006);
    ctx.fillStyle = bookCols[bookI % bookCols.length];
    ctx.fillRect(bookX, shelfY - bookH, bookW, bookH);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(bookX, shelfY - bookH, 1, bookH);
    bookX += bookW + 1;
    bookI += 1;
  }
  ctx.fillStyle = '#191919';
  ctx.fillRect(shelfX0 + 8, shelfY + 4, 2, backH * 0.08);
  ctx.fillRect(shelfX1 - 10, shelfY + 4, 2, backH * 0.08);

  // ---- Left wall in true perspective -------------------------------------
  // The left wall is a trapezoid: full canvas height at the front edge and
  // backH at the back corner. Read as a real wall seen in perspective, its
  // on-screen height is proportional to 1/distance, so equal steps of real
  // depth are NOT equal steps of screen x (the near half of the wall takes
  // ~70% of its width). Everything below is placed in wall units:
  //   z: depth along the wall, 0 at the front edge, WALL_D at the back corner
  //   v: height, 0 at the ceiling, 1 at the floor
  //   d: distance out from the wall into the room
  // all measured in wall-heights, and projected exactly through L3().
  const WALL_D = 1.6;
  const sAtZ = (z) => 1 / (1 / h + (z / WALL_D) * (1 / backH - 1 / h));
  const L3 = (z, v, d = 0) => {
    const s = sAtZ(z);
    const p = sidePoint('left', (h - s) / (h - backH), v);
    return { x: p.x + d * s, y: p.y };
  };
  // The eye this wall implies (same units), used to decide which faces show.
  const eye = { z: -WALL_D / (h / backH - 1), v: backTop / (h - backH), d: backX0 / (h - backH) };
  const v3 = (z, v, d) => ({ z, v, d });
  const add3 = (...ps) => ps.reduce((a, b) => v3(a.z + b.z, a.v + b.v, a.d + b.d));
  const mul3 = (p, k) => v3(p.z * k, p.v * k, p.d * k);
  const pr = (p) => L3(p.z, p.v, p.d);
  // A box from corner o along edges A, B, C; fills keyed a0/a1/b0/b1/c0/c1
  // (face at o, face at o + edge). Only faces turned toward the eye are drawn.
  // proj picks the wall: pr for the left wall, prR (further down) for the right.
  const box3 = (o, A, B, C, fills, proj = pr) => {
    const mid = add3(o, mul3(A, 0.5), mul3(B, 0.5), mul3(C, 0.5));
    [['a', A, B, C], ['b', B, C, A], ['c', C, A, B]].forEach(([k, X, Y, Z]) => {
      [0, 1].forEach((i) => {
        const fill = fills[k + i];
        if (!fill) return;
        const base = i ? add3(o, X) : o;
        const fc = add3(base, mul3(Y, 0.5), mul3(Z, 0.5));
        const out = add3(fc, mul3(mid, -1));
        const toEye = add3(eye, mul3(fc, -1));
        if (out.z * toEye.z + out.v * toEye.v + out.d * toEye.d <= 0) return;
        poly([base, add3(base, Y), add3(base, Y, Z), add3(base, Z)].map(proj), fill);
      });
    });
  };

  // ---- Posters: simple framed prints, hung in a cluster like the shop's wall --
  // Each print is a base colour plus a few blocks, given in the poster's own
  // 0..1 space (a across, b down) so they foreshorten with the wall.
  const FRAME_DEPTH = 0.014;
  const poster = (z0, z1, v0, v1, base, marks, frame = '#141117') => {
    box3(v3(z0, v1, 0), v3(z1 - z0, 0, 0), v3(0, v0 - v1, 0), v3(0, 0, FRAME_DEPTH), {
      a0: '#2a2530', b1: '#3a3440', c1: frame,
    });
    const iz0 = z0 + (z1 - z0) * 0.1;
    const iz1 = z1 - (z1 - z0) * 0.1;
    const iv0 = v0 + (v1 - v0) * 0.07;
    const iv1 = v1 - (v1 - v0) * 0.07;
    const at = (a, b) => L3(lerp(iz0, iz1, a), lerp(iv0, iv1, b), FRAME_DEPTH);
    poly([at(0, 0), at(1, 0), at(1, 1), at(0, 1)], base);
    marks.forEach(([a0, b0, a1, b1, col]) => poly([at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)], col));
  };
  poster(0.05, 0.34, 0.28, 0.7, '#c8282d', [
    [0.2, 0.42, 0.72, 0.78, '#f2e8d2'],
    [0.72, 0.5, 0.86, 0.66, '#f2e8d2'],
    [0.32, 0.14, 0.42, 0.34, '#f0d24a'],
    [0.52, 0.14, 0.62, 0.34, '#f0d24a'],
    [0.14, 0.86, 0.86, 0.92, '#f0d24a'],
  ]);
  poster(0.12, 0.24, 0.75, 0.86, '#ff5f8f', [[0.25, 0.25, 0.75, 0.75, '#f2e8d2'], [0.4, 0.4, 0.6, 0.6, '#1c1a22']], '#f2efe8');
  poster(0.4, 0.54, 0.25, 0.5, '#f0d24a', [
    [0, 0, 1, 0.1, '#2b4fa8'],
    [0.3, 0.2, 0.7, 0.42, '#ff5f8f'],
    [0.38, 0.46, 0.62, 0.8, '#1c1a22'],
  ]);
  poster(0.42, 0.53, 0.56, 0.67, '#1c1a22', [[0.2, 0.2, 0.8, 0.8, '#ff5f8f'], [0.4, 0.4, 0.6, 0.6, '#1c1a22']], '#f2efe8');
  poster(0.7, 0.81, 0.21, 0.32, '#1c1a22', [[0.25, 0.2, 0.75, 0.7, '#e8823a'], [0.38, 0.33, 0.62, 0.57, '#f0d24a']]);
  poster(1.02, 1.12, 0.3, 0.46, '#f2e8d2', [[0.2, 0.15, 0.8, 0.65, '#2b4fa8'], [0.38, 0.3, 0.62, 0.5, '#1c1a22']], '#f2efe8');
  poster(1.2, 1.32, 0.33, 0.49, '#2f6b4a', [[0.25, 0.15, 0.75, 0.6, '#6b3e22'], [0.15, 0.75, 0.85, 0.85, '#f2e8d2']]);
  poster(1.42, 1.5, 0.36, 0.45, '#f2e8d2', [[0.2, 0.2, 0.8, 0.8, '#c8282d']]);

  // ---- TV on a rolling stand, parallel to the wall --------------------------
  // A 55" set (about 1.2 m x 0.7 m on a 3 m wall) standing a little off the
  // wall on a two-pole stand.
  const tvW = 0.41;
  const tvH = 0.235;
  const tvThick = 0.03;
  const tvNearZ = 0.58;
  const tvD = 0.07;
  const tvBottom = 0.6;
  const floorV = 1;
  const metal = '#1b1b1f';
  const metalTop = '#3a3a40';

  // feet on the floor, running out from the wall, and the poles up to the set
  [0.22, 0.78].forEach((k) => {
    const z = tvNearZ + tvW * k;
    box3(v3(z - 0.02, floorV, 0.015), v3(0.04, 0, 0), v3(0, -0.014, 0), v3(0, 0, 0.17), {
      a0: metal, b1: metalTop, c1: '#26262b',
    });
    const top = L3(z, tvBottom - tvH * 0.4, tvD - 0.01);
    const foot = L3(z, floorV - 0.014, tvD - 0.01);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = Math.max(2, sAtZ(z) * 0.014);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(foot.x, foot.y);
    ctx.stroke();
  });

  // the set: a box for the bezel, then the glass on its front
  box3(v3(tvNearZ, tvBottom, tvD), v3(tvW, 0, 0), v3(0, -tvH, 0), v3(0, 0, tvThick), {
    a0: '#24242a', b1: '#2a2a30', c1: '#070709',
  });
  const glass = (a, b) => L3(tvNearZ + tvW * lerp(0.03, 0.97, a), tvBottom - tvH * lerp(0.05, 0.95, b), tvD + tvThick);
  poly([glass(0, 0), glass(1, 0), glass(1, 1), glass(0, 1)], '#1a2e38');
  poly([glass(0, 0.45), glass(0, 1), glass(0.3, 1)], '#2e5562');
  const dot = glass(0.96, 0.02);
  ctx.fillStyle = '#ff4f3a';
  ctx.fillRect(dot.x - 2, dot.y - 3, 3, 3);

  const seat = (d) => {
    const d0 = d - 0.026;
    const d1 = d + 0.026;
    const dx = w * 0.017;
    const p = sidePoint('left', d, 1);
    ctx.fillStyle = 'rgba(0,0,0,.26)';
    ctx.beginPath();
    ctx.ellipse(p.x + dx * 0.7, p.y + 1, dx * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    leftBox(d0, d1, 0.929, 1, dx, '#969692', '#757572', '#5e5e5c');
    leftBox(d0, d1, 0.857, 0.929, dx, '#8b8b87', '#6d6d6a', '#565654');
    leftBox(d0, d1, 0.838, 0.857, dx, '#8a7f76', '#70645b', '#5a5049');
    ctx.strokeStyle = 'rgba(28,28,30,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + dx * 0.25, p.y - (p.y - sidePoint('left', d, 0.857).y) * 0.5);
    ctx.lineTo(p.x + dx * 0.75, p.y - (p.y - sidePoint('left', d, 0.857).y) * 0.5);
    ctx.stroke();
  };
  const crate = (d) => {
    const d0 = d - 0.022;
    const d1 = d + 0.022;
    const dx = w * 0.015;
    const p = sidePoint('left', d, 1);
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.beginPath();
    ctx.ellipse(p.x + dx * 0.7, p.y + 1, dx * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    leftBox(d0, d1, 0.893, 1, dx, '#e08a3a', '#c25c1f', '#8a3e14');
    ctx.strokeStyle = 'rgba(90,33,8,.45)';
    ctx.lineWidth = 1;
    [0.925, 0.955, 0.982].forEach((v) => {
      const a = sidePoint('left', d0, v);
      ctx.beginPath();
      ctx.moveTo(a.x + 2, a.y);
      ctx.lineTo(a.x + dx + 2, a.y);
      ctx.stroke();
    });
    const top = sidePoint('left', d, 0.893);
    ctx.fillStyle = '#f2ece0';
    ctx.fillRect(top.x + dx * 0.55, top.y - 4, 4, 3);
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(top.x + dx * 0.55, top.y - 2, 4, 1);
  };
  const seatD = w < 820 ? [0.63, 0.665, 0.7] : [0.56, 0.615, 0.67];
  seat(seatD[2]);
  crate(seatD[1]);
  seat(seatD[0]);

  // ---- Cabinet along the right wall, built as a real box -------------------
  // The right wall mirrors the left one, so the same wall units apply: z along
  // the wall, v down from the ceiling, d out from the wall into the room.
  const R3 = (z, v, d = 0) => {
    const s = sAtZ(z);
    const p = sidePoint('right', (h - s) / (h - backH), v);
    return { x: p.x - d * s, y: p.y };
  };
  const prR = (p) => R3(p.z, p.v, p.d);
  const tToZ = (tt) => {
    const s = h + (backH - h) * tt;
    return ((1 / s - 1 / h) / (1 / backH - 1 / h)) * WALL_D;
  };
  const cabZ0 = tToZ(0.3);
  const cabZ1 = tToZ(0.985);
  const cabLen = cabZ1 - cabZ0;
  const cabTop = 0.68; // about 1 m high on a 3 m wall
  const cabD = w < 820 ? 0.055 : 0.085; // a slim counter, about 25 cm deep (shallower on phones)
  // recessed kick plinth
  box3(v3(cabZ0 + 0.01, 1, 0), v3(cabLen - 0.01, 0, 0), v3(0, -0.04, 0), v3(0, 0, cabD - 0.025), {
    a0: '#1e140e', b1: '#1e140e', c1: '#24170f',
  }, prR);
  // carcass
  box3(v3(cabZ0, 0.96, 0), v3(cabLen, 0, 0), v3(0, cabTop + 0.02 - 0.96, 0), v3(0, 0, cabD), {
    a0: '#5a3e2a', b1: '#5a3e2a', c1: '#3e2a1d',
  }, prR);
  // doors on the front, each with a handle near the top
  const doors = 4;
  for (let i = 0; i < doors; i++) {
    const z0 = cabZ0 + (cabLen * i) / doors + 0.012;
    const z1 = cabZ0 + (cabLen * (i + 1)) / doors - 0.012;
    const dd = cabD + 0.002;
    poly([R3(z0, cabTop + 0.05, dd), R3(z1, cabTop + 0.05, dd), R3(z1, 0.935, dd), R3(z0, 0.935, dd)], '#4a3324');
    poly([R3(z0 + 0.02, cabTop + 0.08, dd), R3(z1 - 0.02, cabTop + 0.08, dd), R3(z1 - 0.02, 0.905, dd), R3(z0 + 0.02, 0.905, dd)], '#55392a');
    const hz = i % 2 ? z0 + 0.03 : z1 - 0.03;
    box3(v3(hz - 0.006, cabTop + 0.16, dd), v3(0.012, 0, 0), v3(0, -0.06, 0), v3(0, 0, 0.012), {
      a0: '#8a8a86', b1: '#b8b8b2', c1: '#a3a39e',
    }, prR);
  }
  // countertop slab with a small overhang
  box3(v3(cabZ0 - 0.015, cabTop + 0.02, 0), v3(cabLen + 0.015, 0, 0), v3(0, -0.035, 0), v3(0, 0, cabD + 0.025), {
    a0: '#7a5638', b1: '#9a704c', c1: '#6b4a32',
  }, prR);

  // bottles standing on the counter, centred on its depth so they sit fully on the top
  const bottleCols = ['#b8621c', '#d29a4a', '#7fc84a', '#e8d8a8'];
  const bottleW = Math.min(0.035, cabD * 0.6);
  const neckW = bottleW * 0.37;
  for (let i = 0; i < 4; i++) {
    const z = lerp(cabZ0, cabZ1, 0.3 + i * 0.16);
    const base = v3(z, cabTop - 0.015, (cabD - bottleW) / 2);
    box3(base, v3(bottleW, 0, 0), v3(0, -0.1, 0), v3(0, 0, bottleW), {
      a0: bottleCols[i], b1: bottleCols[i], c1: bottleCols[i],
    }, prR);
    box3(add3(base, v3((bottleW - neckW) / 2, -0.1, (bottleW - neckW) / 2)), v3(neckW, 0, 0), v3(0, -0.035, 0), v3(0, 0, neckW), {
      a0: '#2a1a12', b1: '#2a1a12', c1: '#2a1a12',
    }, prR);
  }

  const peg0 = 0.42;
  const peg1 = 0.94;
  const pegV0 = 0.18;
  const pegV1 = 0.5;
  poly(wallQuad('right', peg0, peg1, pegV0, pegV1), '#080809');
  poly(wallQuad('right', peg0 + 0.008, peg1 - 0.008, pegV0 + 0.012, pegV1 - 0.012), '#1c1c1e');
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 4; j++) {
      const p = sidePoint('right', lerp(peg0, peg1, (i + 0.5) / 9), lerp(pegV0, pegV1, (j + 0.5) / 4));
      ctx.fillStyle = '#060607';
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }
  const pack = ['#f4f4f0', '#ffe2ec', '#c0282d', '#2b4fa8', '#f2c418', '#3ddc97', '#ff7a12', '#7d3cff'];
  for (let i = 0; i < 8; i++) {
    const t2 = lerp(peg0 + 0.03, peg1 - 0.03, ((i * 37) % 100) / 100);
    const v2 = lerp(pegV0 + 0.04, pegV1 - 0.04, ((i * 53) % 100) / 100);
    const p = sidePoint('right', t2, v2);
    const s = Math.max(5, Math.round(10 * (1.05 - t2 * 0.4)));
    ctx.fillStyle = pack[i % pack.length];
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.fillStyle = pack[(i + 3) % pack.length];
    ctx.fillRect(p.x - s * 0.25, p.y - s * 0.25, s * 0.5, s * 0.35);
  }
  for (let i = 0; i < 3; i++) {
    const p = sidePoint('right', 0.6 + i * 0.08, 0.28);
    const s = Math.max(2, w * 0.0025 * (1.1 - (0.6 + i * 0.08) * 0.4));
    ctx.fillStyle = '#d8261e';
    ctx.fillRect(p.x, p.y, s, backH * 0.13);
    ctx.fillRect(p.x - s, p.y + backH * 0.11, s * 3, s * 3);
  }
  for (let i = 0; i < 3; i++) {
    const p = sidePoint('right', 0.78 + i * 0.05, 0.42);
    const s = Math.max(4, w * 0.007 * (1.1 - (0.78 + i * 0.05) * 0.4));
    ctx.fillStyle = '#b9bec2';
    ctx.fillRect(p.x - s / 2, p.y - s, s, s);
    ctx.fillStyle = '#e8e8e4';
    ctx.fillRect(p.x - s / 2 + 1, p.y - s + 1, s - 2, 2);
    ctx.fillStyle = '#b9bec2';
    ctx.fillRect(p.x + s / 2, p.y - s * 0.7, 2, s * 0.4);
  }

  // ---- 8-bit lighting: a few flat, hard-edged layers, no soft gradients ----
  const floorH = h - backBottom;
  const steps = (cx, cy, rx, ry, color, n) => {
    for (let k = 0; k < n; k++) {
      const f = 1 - k / n;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * f, ry * f, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  // on the floor: pools under the ceiling lights, and a fall-off toward the camera
  ctx.save();
  path(floorPts);
  ctx.clip();
  steps(w * 0.5, backBottom + floorH * 0.22, w * 0.16, floorH * 0.16, 'rgba(255,240,215,.13)', 2);
  steps(w * 0.27, backBottom + floorH * 0.42, w * 0.1, floorH * 0.11, 'rgba(255,240,215,.12)', 1);
  steps(w * 0.75, backBottom + floorH * 0.38, w * 0.1, floorH * 0.11, 'rgba(255,240,215,.12)', 1);
  ctx.fillStyle = 'rgba(10,8,20,.14)';
  ctx.fillRect(0, backBottom + floorH * 0.62, w, h);
  ctx.fillRect(0, backBottom + floorH * 0.84, w, h);
  ctx.restore();
  // red spill around the neon sign
  steps(nx, ny, nr * 2.1, nr * 1.7, 'rgba(255,70,50,.12)', 2);
  // the walls darken up under the ceiling
  ctx.fillStyle = 'rgba(10,8,20,.14)';
  ctx.fillRect(backX0, 0, backW, backTop + backH * 0.1);
  poly([{ x: 0, y: 0 }, { x: backX0, y: backTop }, { x: backX0, y: backTop + backH * 0.3 }, { x: 0, y: h * 0.28 }], 'rgba(10,8,20,.14)');
  poly([{ x: w, y: 0 }, { x: backX1, y: backTop }, { x: backX1, y: backTop + backH * 0.3 }, { x: w, y: h * 0.28 }], 'rgba(10,8,20,.14)');
  return { nx, ny, nr };
}

function drawNeonText(ctx, nx, ny, nr) {
  ctx.save();
  ctx.fillStyle = '#ffd0b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const neonSize = Math.max(10, Math.round(nr * 0.5));
  ctx.font = `${neonSize}px "DotGothic16", sans-serif`;
  ctx.fillText('窺視', nx, ny - nr * 0.24);
  ctx.fillText('珈琲', nx, ny + nr * 0.29);
  ctx.restore();
}

function targetPoint(L, side) {
  if (side === 'player') return { x: L.player.x, y: L.player.y - 70 * L.scale };
  return { x: L.enemy.x, y: L.enemy.y - 55 * L.scale };
}

function drawSprite(ctx, base, white, at, scale, reveal, faintedAt, hitFx, now, dir) {
  const faint = faintedAt ? Math.min(1, (now - faintedAt) / 900) : 0;
  if (faintedAt && faint >= 1) return;
  const alpha = Math.max(0, Math.min(1, reveal)) * (1 - faint * 0.2);
  const w = base.width * scale;
  const h = base.height * scale;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha * 0.5);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(at.x, at.y + 2, w * 0.34, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(at.x, at.y);
  if (faintedAt) {
    // drops straight down through the floor line, clipped at its feet so it sinks out of sight
    ctx.beginPath();
    ctx.rect(-w, -h * 2, w * 2, h * 2 + 2);
    ctx.clip();
    ctx.translate(0, Math.pow(faint, 1.6) * (h + 4));
  }
  let shake = 0;
  if (hitFx) {
    const hp = Math.min(1, (now - hitFx.t0) / hitFx.dur);
    shake = Math.sin(hp * 60) * 6 * scale * (1 - hp);
  }
  ctx.translate(shake, 0);
  ctx.imageSmoothingEnabled = false;
  if (hitFx) {
    const hp = Math.min(1, (now - hitFx.t0) / hitFx.dur);
    ctx.save();
    ctx.globalAlpha = alpha * 0.45 * Math.abs(Math.sin(hp * 40)) * (1 - hp);
    ctx.drawImage(white, -w / 2, -h, w, h);
    ctx.restore();
  }
  ctx.drawImage(base, -w / 2, -h, w, h);
  ctx.restore();
}

// ---- Move effects: chunky 8-bit pieces on the same grid as the sprites -------
const FX_PAL = {
  B: '#7a4a2c', b: '#4a2c18', S: '#f4efe3', K: '#14121a', R: '#d0503e', G: '#9aa3a0', g: '#6c7471',
  L: '#a6e05a', C: '#c08a5a', c: '#5a341f', W: '#fff7e0', H: '#ff5f8f', h: '#c8325a', U: '#8de2ff',
  u: '#4f9fc7', E: '#f2b98c', e: '#c4805a', A: '#4a5a86', a: '#2f3a5e', P: '#ff9fc0',
};
const SLIPPER_GRID = ['.bbbbbbbbb.', 'bBSSBBBBBBb', 'BSSSSBBBBBB', 'bBSSBBBBBBb', '.bbbbbbbbb.'];
const CAN_GRID = ['.KK.', '.RR.', 'GGGG', 'GLLG', 'GLLG', 'GLLG', 'gggg'];
const CUP_GRID = ['SSSSS.', 'ScccS.', 'ScccSSS', 'ScccS.S', 'SSSSSSS', '.SSS...'];
const LATTE_GRID = [
  '..SSSSSSS....',
  '.SCCCCCCCS...',
  'SCWWWWWWWCS..',
  'SCWCWWCWWCS..',
  'SCWWWWWWWCS..',
  'SCCWWWWWCCS..',
  'SCCWWCWWCCS..',
  'SCCWWWWWCCS..',
  '.SCCCCCCCSSS.',
  '..SSSSSSS.SSS',
  '...KKKKK.....',
  '..KKKKKKK....',
];
const HEAL_GRID = ['..L..', '..L..', 'LLLLL', '..L..', '..L..'];
const BROOM_GRID = ['...bb...', '...bb...', '...bb...', '...bb...', '..bBBb..', '..RRRR..', '.bBBBBb.', 'bBBBBBBb'];
const NOTE_GRID = ['.....KK..', '....KKK..', '....K.K..', '....K.K..', '....K.K..', '....K.K..', '.KKK.K...', 'KKKKKK...', 'KKKKK....', '.KK......'];
const CAKE_GRID = ['..R...', '.WWW..', 'CCCCCC', 'CCWWCC', 'CCCCCC', 'KKKKKK'];
const ANGER_GRID = ['R...R', '.R.R.', '..R..', '.R.R.', 'R...R'];

const DOTS_GRID = ['..W..', '..W..', '..W..'];
// an ear from the side (someone facing right): flat where it meets the head on the right, its rim rounding over the
// top and down the back to the lobe, the fold inside it in shade, and the dark opening toward the face
const EAR_GRID = [
  '...KKKKK..',
  '..KEEEEEKK',
  '.KEEeeeeEK',
  'KEEeEEEEeK',
  'KEeEEEEEEK',
  'KEeEEeeEEK',
  'KEeEeKKeEK',
  'KEeEeKKEEK',
  'KEEeEeeEEK',
  '.KEEeEEEK.',
  '.KEEEeEEK.',
  '..KEEEEK..',
  '..KEEEK...',
  '...KKK....',
];
const STAR_GRID = ['.....KK.....', '....KWWK....', '....KWWK....', 'KKKKWWWWKKKK', '.KWWWWWWWWK.', '..KWWWWWWK..', '..KWWWWWWK..', '.KWWK..KWWK.', 'KWWK....KWWK', '.KK......KK.'];
const TABLE_GRID = ['KKKKKKKKKKKK', 'KGGGGGGGGGGK', 'KGGGGGGGGGGK', 'KKKKKKKKKKKK', '..KK....KK..', '..KK....KK..'];
// 拍桌的拳頭, a ✊ turned over to come down knuckles first: the sleeve and wrist above, the back of the hand, the
// thumb folded across the front, and the four fingers' knuckles side by side at the bottom
const FIST_GRID = [
  '..KAAAAAAAK..',
  '..KAAAAAAaK..',
  '..KaaaaaaaK..',
  '.KKEEEEEEEKK.',
  '.KEEEEEEEEEK.',
  'KEEEEEEEEEEEK',
  'KKKKKKKKKEEEK',
  'KEEEEEEEEKEEK',
  'KeeeeeeeeKEEK',
  'KKKKKKKKKKEEK',
  'KEEKEEKEEKEEK',
  'KEEKEEKEEKEEK',
  'KEeKEeKEeKEeK',
  '.KK.KK.KK.KK.',
];
// 抽取式面紙: a flat box, flowers on its side, the oval slot in its top with a sheet standing up out of it
const TISSUE_GRID = [
  '.......KK.......',
  '......KWWK......',
  '.....KWWSWK.....',
  '....KWWWSWWK....',
  '....KWWWWSWK....',
  '.KKKKKWWWWKKKKK.',
  'KUUUUKSSSSKUUUUK',
  'KUUUUUKKKKUUUUUK',
  'KKKKKKKKKKKKKKKK',
  'KuuuPuuuuuuPuuuK',
  'KuuPPPuuuuPPPuuK',
  'KuuuPuuuuuuPuuuK',
  'KuuuuuuuuuuuuuuK',
  'KKKKKKKKKKKKKKKK',
];
// one sheet pulled free, drifting
const SHEET_GRID = ['..KKKK..', '.KWWWWK.', 'KWWSWWWK', 'KWWWSWWK', '.KWWWWSK', '..KWWWK.', '...KKK..'];
// 店規立牌: a board on a pointed stake (the words are written onto the board when it is drawn)
const SIGN_GRID = [
  'KKKKKKKKKKKKKKKKKK',
  'KBBBBBBBBBBBBBBBBK',
  'KBWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWBK',
  'KBSSSSSSSSSSSSSSBK',
  'KBbbbbbbbbbbbbbbBK',
  'KKKKKKKKKKKKKKKKKK',
  '.......KBbK.......',
  '.......KBbK.......',
  '.......KBbK.......',
  '.......KBbK.......',
  '.......KBbK.......',
  '.......KBbK.......',
  '.......KBbK.......',
  '.......KBbK.......',
  '........Kb........',
  '........KK........',
];
const SIGN_SUNK = 3;   // rows of the stake driven into the floor

function fxPixel(L) {
  return Math.max(2, Math.round(L.scale * 4));
}

// draw a character grid centred on (cx, cy), one cell = px * k screen pixels
function drawGrid(ctx, grid, cx, cy, px, k = 1, pal = FX_PAL, rows = grid.length) {
  const cell = px * k;
  const x0 = Math.round(cx / px) * px - (grid[0].length * cell) / 2;
  const y0 = Math.round(cy / px) * px - (grid.length * cell) / 2;
  for (let r = 0; r < Math.min(rows, grid.length); r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const col = pal[grid[r][c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
    }
  }
}

function block(ctx, x, y, size, px, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x / px) * px - size / 2, Math.round(y / px) * px - size / 2, size, size);
}

function healSparks(ctx, at, p, s, count = 6) {
  ctx.save();
  ctx.fillStyle = '#89ffb9';
  for (let i = 0; i < count; i++) {
    const q = (p + i / count) % 1;
    const x = at.x + Math.sin(i * 2.4 + q * 4) * 54 * s;
    const y = at.y - 20 * s - q * 100 * s;
    ctx.globalAlpha = 1 - q;
    ctx.fillRect(x - s, y - 4 * s, 2 * s, 8 * s);
    ctx.fillRect(x - 4 * s, y - s, 8 * s, 2 * s);
  }
  ctx.restore();
}

function calmAura(ctx, at, p, s) {
  ctx.save();
  ctx.strokeStyle = '#89ffb9';
  ctx.lineWidth = 3 * s;
  ctx.globalAlpha = 1 - p;
  ctx.beginPath();
  ctx.arc(at.x, at.y, (44 + p * 34) * s, -Math.PI * 0.85, Math.PI * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(at.x, at.y, (58 + p * 40) * s, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

// a starburst of blocks flying out from (cx, cy)
function burst(ctx, cx, cy, q, px, { rays = 8, len = 60, colors = ['#fff7d6', '#ffd23f'], size = 2, spin = 0 } = {}) {
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * Math.PI * 2 + spin;
    for (let k = 0; k < 3; k++) {
      const r = len * (0.25 + q * 0.75) - k * px * 2.2;
      if (r <= 0) continue;
      block(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.8, px * Math.max(1, size - k), px, colors[k % colors.length]);
    }
  }
}

function popText(ctx, text, x, y, q, s, color) {
  const pop = q < 0.25 ? 0.6 + (q / 0.25) * 0.6 : 1.2 - Math.min(0.2, (q - 0.25) * 0.4);
  ctx.save();
  ctx.globalAlpha = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
  ctx.translate(x, y - q * 18 * s);
  ctx.scale(pop, pop);
  ctx.font = `bold ${Math.max(22, Math.round(34 * s))}px "DotGothic16", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(4, 6 * s);
  ctx.strokeStyle = '#14121a';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function flyText(ctx, text, from, to, p, s, color) {
  const q = Math.min(1, p);
  const arc = Math.sin(q * Math.PI) * 70 * s;
  const x = from.x + (to.x - from.x) * Math.min(1, q * 1.15);
  const y = from.y + (to.y - from.y) * Math.min(1, q * 1.15) - 40 * s - arc;
  popText(ctx, text, x, y, q, s, color);
}

function scatterSymbols(ctx, text, at, p, s, color) {
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const q = (p + i / chars.length) % 1;
    const ang = i * 2.1 + q * 1.6;
    const r = (34 + (i % 3) * 16) * s;
    popText(ctx, chars[i], at.x + Math.cos(ang) * r, at.y - 30 * s - q * 76 * s, q, s, color);
  }
}

function flyGrid(ctx, grid, from, to, p, s, px, k = 2, offsetY = 0) {
  const arc = Math.sin(Math.min(1, p) * Math.PI) * 70 * s;
  const x = from.x + (to.x - from.x) * Math.min(1, p * 1.15);
  const y = from.y + (to.y - from.y) * Math.min(1, p * 1.15) - 40 * s - arc + offsetY * s;
  drawGrid(ctx, grid, x, y, px, k);
}

function sweepBroom(ctx, from, to, p, s, px) {
  const q = Math.min(1, p / 0.65);
  const x = from.x + (to.x - from.x) * q;
  const y = from.y - 30 * s + (to.y - from.y) * q;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.9 + q * 1.8);
  drawGrid(ctx, BROOM_GRID, 0, 0, px, 3);
  ctx.restore();
}

function fallGrid(ctx, grid, to, p, s, px, k = 3) {
  const y = to.y - 130 * s + 100 * s * Math.min(1, p * 1.5);
  drawGrid(ctx, grid, to.x, y, px, k);
}

function floatMarks(ctx, grid, to, p, s, px, count = 5) {
  for (let i = 0; i < count; i++) {
    const q = (p + i / count) % 1;
    const x = to.x + Math.sin(i * 2.1 + q * 5) * 46 * s;
    const y = to.y - 20 * s - q * 90 * s;
    ctx.save();
    ctx.globalAlpha = 1 - q;
    drawGrid(ctx, grid, x, y, px, 1);
    ctx.restore();
  }
}

function fxSlipper(ctx, from, to, p, s, px) {
  const HIT = 0.62;
  if (p < HIT) {
    // wind up: fly in a high arc to above the spider, flipping in quarter turns
    const q = p / HIT;
    const x = from.x + (to.x - from.x) * q;
    const y = from.y + (to.y - 80 * s - from.y) * q - Math.sin(q * Math.PI) * 90 * s;
    ctx.save();
    ctx.translate(Math.round(x / px) * px, Math.round(y / px) * px);
    ctx.rotate((Math.round(q * 6) * Math.PI) / 2);
    drawGrid(ctx, SLIPPER_GRID, 0, 0, px, 2 + Math.round(q));
    ctx.restore();
    return;
  }
  const q = (p - HIT) / (1 - HIT);
  // slam: squashed flat on the spider
  if (q < 0.45) {
    ctx.save();
    ctx.translate(to.x, to.y - 20 * s);
    ctx.scale(1.25, 0.6);
    drawGrid(ctx, SLIPPER_GRID, 0, 0, px, 3);
    ctx.restore();
  }
  burst(ctx, to.x, to.y, q, px, { rays: 10, len: 90 * s, colors: ['#fff7d6', '#ffd23f', '#e0583f'], size: 3 });
  // dust kicked up on the floor either side
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const dx = side * (30 + i * 10) * s * (0.4 + q);
    block(ctx, to.x + dx, to.y + 46 * s - q * 14 * s - i * 2 * s, px * (2 - (i % 2)), px, 'rgba(220,210,196,.85)');
  }
  popText(ctx, '啪！', to.x + 40 * s, to.y - 70 * s, q, s, '#ffd23f');
}

function fxSpray(ctx, from, to, p, s, px) {
  const dir = Math.sign(to.x - from.x) || 1;
  const nozzle = { x: from.x + dir * 46 * s, y: from.y - 6 * s };
  if (p < 0.8) drawGrid(ctx, CAN_GRID, nozzle.x - dir * 8 * s, nozzle.y + 10 * s, px, 2);
  // mist: puffs leave the nozzle over time and widen into a cone
  const mist = ['#d9f5b0', '#a6e05a', '#cf8bff', '#eef9d8'];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const t0 = 0.05 + (i / N) * 0.5;
    const q = (p - t0) / 0.32;
    if (q < 0 || q > 1) continue;
    const hash = Math.sin(i * 12.9898) * 43758.5453;
    const spread = hash - Math.floor(hash) - 0.5; // scattered, not a wave
    const x = nozzle.x + (to.x - nozzle.x) * q;
    const y = nozzle.y + (to.y - nozzle.y) * q + spread * 120 * s * q;
    block(ctx, x, y, px * (2 + Math.round(q * 2)), px, mist[i % mist.length]);
  }
  // the poison cloud hangs on the spider, bubbles rising out of it
  if (p > 0.55) {
    const q = (p - 0.55) / 0.45;
    for (let i = 0; i < 12; i++) {
      const ang = i * 0.52 + q * 3;
      const r = (44 + (i % 3) * 12) * s;
      block(ctx, to.x + Math.cos(ang) * r, to.y + Math.sin(ang) * r * 0.6, px * (3 + (i % 2)), px, i % 2 ? '#a6e05a' : '#9b6bd6');
    }
    for (let i = 0; i < 7; i++) {
      const rise = ((q * 1.6 + i * 0.17) % 1) * 70 * s;
      block(ctx, to.x + (i - 3) * 14 * s, to.y - rise, px * (1 + (i % 2)), px, '#cf8bff');
    }
    if (q > 0.2) popText(ctx, '毒！', to.x + 44 * s, to.y - 72 * s, (q - 0.2) / 0.8, s, '#cf8bff');
  }
}

function fxCoffee(ctx, from, to, p, s, px) {
  const dir = Math.sign(to.x - from.x) || 1;
  const cupAt = { x: from.x + dir * 40 * s, y: from.y - 10 * s };
  if (p < 0.4) {
    ctx.save();
    ctx.translate(cupAt.x, cupAt.y);
    ctx.rotate(dir * Math.min(1, p / 0.15) * (Math.PI / 2));
    drawGrid(ctx, CUP_GRID, 0, 0, px, 2);
    ctx.restore();
  }
  // the pour: blobs arc over with drips trailing and steam coming off them
  for (let i = 0; i < 10; i++) {
    const q = (p - 0.1 - i * 0.025) / 0.5;
    if (q < 0 || q > 1) continue;
    const x = cupAt.x + (to.x - cupAt.x) * q;
    const y = cupAt.y + (to.y - cupAt.y) * q - Math.sin(q * Math.PI) * (110 * s - i * 4 * s);
    block(ctx, x, y, px * (i % 3 === 0 ? 4 : 3), px, i % 2 ? '#5a341f' : '#8a5230');
    block(ctx, x - dir * 10 * s, y + 8 * s, px * 2, px, '#3a2014');
    if (i % 2 === 0) block(ctx, x, y - 14 * s - q * 10 * s, px, px, 'rgba(255,255,255,.7)');
  }
  // splash: drops thrown out and falling back, steam rising off the spider
  if (p > 0.6) {
    const q = (p - 0.6) / 0.4;
    for (let i = 0; i < 14; i++) {
      const ang = -Math.PI + (i / 13) * Math.PI;
      const v = (60 + (i % 4) * 14) * s;
      const x = to.x + Math.cos(ang) * v * q;
      const y = to.y + Math.sin(ang) * v * q + 120 * s * q * q;
      block(ctx, x, y, px * (3 - (i % 2)), px, i % 2 ? '#5a341f' : '#8a5230');
    }
    for (let i = 0; i < 6; i++) {
      const x = to.x + (i - 2.5) * 16 * s + Math.sin(q * 6 + i) * 5 * s;
      const y = to.y - 20 * s - q * 70 * s - (i % 2) * 12 * s;
      ctx.save();
      ctx.globalAlpha = 1 - q;
      block(ctx, x, y, px * 2, px, '#f4efe3');
      ctx.restore();
    }
    popText(ctx, '燙！', to.x + 42 * s, to.y - 70 * s, q, s, '#ff9a62');
  }
}

function fxLatte(ctx, from, to, p, s, px) {
  if (p < 0.68) {
    flyGrid(ctx, LATTE_GRID, from, to, p / 0.68, s, px, 4);
    return;
  }
  const q = (p - 0.68) / 0.32;
  if (q < 0.4) drawGrid(ctx, HEAL_GRID, to.x, to.y - 40 * s, px, 3);
  burst(ctx, to.x, to.y, q, px, { rays: 10, len: 90 * s, colors: ['#fff7d6', '#89ffb9'], size: 2, spin: 0.2 });
  healSparks(ctx, to, q, s, 6);
  popText(ctx, '＋', to.x + 40 * s, to.y - 68 * s, q, s, '#89ffb9');
}

function fxTissue(ctx, from, to, p, s, px) {
  if (p < 0.55) {
    flyGrid(ctx, TISSUE_GRID, from, { x: to.x - 84 * s, y: to.y + 40 * s }, p / 0.55, s, px, 2);
    return;
  }
  // the box lands on the floor beside them, and a sheet is drawn up out of it and floats over to them
  const q = (p - 0.55) / 0.45;
  const boxX = to.x - 84 * s;
  const boxY = to.y + 55 * s - (TISSUE_GRID.length * px * 2) / 2;   // (targetPoint is 55 up from their feet)
  const land = Math.min(1, q / 0.15);
  drawGrid(ctx, TISSUE_GRID, boxX, boxY - Math.sin(land * Math.PI) * 6 * s, px, 2);
  if (q > 0.15) {
    const r = (q - 0.15) / 0.85;
    ctx.save();
    ctx.globalAlpha = r > 0.75 ? 1 - (r - 0.75) / 0.25 : 1;
    drawGrid(ctx, SHEET_GRID, boxX + r * 60 * s + Math.sin(r * Math.PI * 3) * 10 * s, boxY - 40 * s - r * 50 * s, px, 2);
    ctx.restore();
  }
  popText(ctx, '擦一擦吧', to.x + 52 * s, to.y - 86 * s, q, s, '#fff7d6');
}

// the sign, standing on the floor at (x, ground): drop moves it up (negative) off the floor, tilt leans it about the
// foot of its stake; nothing below the floor is drawn, so the stake's point is buried
function drawStandSign(ctx, x, ground, px, s, { drop = 0, tilt = 0, flash = 0, alpha = 1 } = {}) {
  const cell = px * 2;
  const cols = SIGN_GRID[0].length;
  const rows = SIGN_GRID.length;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(Math.round(x / px) * px, Math.round(ground / px) * px);
  ctx.beginPath();
  ctx.rect(-cols * cell * 2, -4000, cols * cell * 4, 4000);
  ctx.clip();
  // its shadow on the floor, once it is down
  if (drop > -cell) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(-cell * 3, -cell * 0.5, cell * 6, cell * 0.5);
  }
  ctx.translate(0, Math.round(drop / px) * px);
  ctx.rotate(tilt);
  const x0 = (-cols * cell) / 2;
  const y0 = SIGN_SUNK * cell - rows * cell;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = SIGN_GRID[r][c];
      const col = FX_PAL[key];
      if (!col) continue;
      ctx.fillStyle = flash > 0 && key !== 'K' ? '#ffffff' : col;
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
    }
  }
  if (flash <= 0) {
    ctx.font = `bold ${Math.round(cell * 5.4)}px "DotGothic16", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c8325a';
    ctx.fillText('店規', 0, y0 + cell * 5.2);
  }
  ctx.restore();
}

// where the sign stands: on the floor just in front of the owner, toward the other side
function signSpot(L) {
  return { x: L.player.x + 128 * L.scale, ground: L.player.y - 4 * L.scale };
}

// 立起店規立牌: it drops out of the sky and its stake drives into the floor, throwing up dust, then rocks to a stop
function fxSign(ctx, L, p, px) {
  const s = L.scale;
  const { x, ground } = signSpot(L);
  const FALL = 0.28;
  if (p < FALL) {
    const q = p / FALL;
    drawStandSign(ctx, x, ground, px, s, { drop: -(1 - q * q) * (ground + 40 * s) - 6 * s });
    return;
  }
  const q = (p - FALL) / (1 - FALL);
  const rock = Math.sin(q * Math.PI * 5) * 0.09 * Math.max(0, 1 - q * 1.6);
  const bounce = q < 0.08 ? -Math.sin((q / 0.08) * Math.PI) * 4 * s : 0;
  drawStandSign(ctx, x, ground, px, s, { drop: bounce, tilt: rock });
  // dust kicked out along the floor either side, and cracks where it went in
  if (q < 0.6) {
    const d = q / 0.6;
    ctx.save();
    ctx.globalAlpha = 1 - d;
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const dx = side * (14 + d * (40 + i * 10)) * s;
        const dy = -Math.sin(d * Math.PI) * (10 + (i % 3) * 8) * s;
        block(ctx, x + dx, ground + dy - i * 2 * s, px * (i % 2 ? 2 : 3), px, i % 2 ? '#a89f90' : '#d8cfc0');
      }
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - q * 0.9);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) block(ctx, x + side * (px * 3 + i * px * 2), ground + (i % 2) * px, px, px, '#14121a');
  }
  ctx.restore();
  if (q < 0.25) {
    // the jolt of it landing
    ctx.save();
    ctx.globalAlpha = 0.35 * (1 - q / 0.25);
    ctx.fillStyle = '#fff7e0';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.restore();
  }
  popText(ctx, '咚！', x + 70 * s, ground - 150 * s, Math.min(1, q * 1.4), s, '#ffd23f');
}

// the sign taking the blow meant for the owner: it flashes and shakes, then falls over backward and is gone
function fxSignBlock(ctx, L, p, px) {
  const s = L.scale;
  const { x, ground } = signSpot(L);
  if (p < 0.35) {
    const shake = Math.sin(p * 90) * 4 * s;
    drawStandSign(ctx, x + shake, ground, px, s, { flash: Math.sin(p * 60) > 0 ? 1 : 0 });
    return;
  }
  const q = (p - 0.35) / 0.65;
  drawStandSign(ctx, x, ground, px, s, { tilt: -q * q * 1.4, alpha: 1 - q });
}

function drawMoveFx(ctx, fx, p, L) {
  const from = targetPoint(L, fx.from);
  const to = targetPoint(L, fx.target);
  const s = L.scale;

  switch (fx.fx) {
    case 'slipper':
      fxSlipper(ctx, from, to, p, s, fxPixel(L));
      break;
    case 'spray':
      fxSpray(ctx, from, to, p, s, fxPixel(L));
      break;
    case 'coffee':
      fxCoffee(ctx, from, to, p, s, fxPixel(L));
      break;
    case 'latte':
      fxLatte(ctx, from, to, p, s, fxPixel(L));
      break;
    case 'tissue':
      fxTissue(ctx, from, to, p, s, fxPixel(L));
      break;
    case 'bite': {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,79,123,.95)';
      ctx.lineWidth = 4 * s;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(to.x - 20 * s + i * 14 * s, to.y - 26 * s);
        ctx.lineTo(to.x - 10 * s + i * 14 * s, to.y + 18 * s);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'web': {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1.5 * s;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const r = 45 * s * (0.4 + p);
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x + Math.cos(ang) * r, to.y + Math.sin(ang) * r);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(to.x, to.y, 30 * s * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'poison': {
      ctx.save();
      ctx.fillStyle = 'rgba(196,120,255,.85)';
      for (let i = 0; i < 7; i++) {
        const ang = i * 1.9 + p * 4;
        const r = (15 + i * 5) * s;
        ctx.beginPath();
        ctx.arc(
          to.x + Math.cos(ang) * r,
          to.y + Math.sin(ang) * r - p * 20 * s,
          (3 + (i % 3)) * s,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'pounce': {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,63,.8)';
      ctx.lineWidth = 3 * s;
      for (let i = 0; i < 4; i++) {
        const y = to.y - 25 * s + i * 12 * s;
        ctx.beginPath();
        ctx.moveTo(to.x - 45 * s - p * 20 * s, y);
        ctx.lineTo(to.x - 20 * s, y);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'broom':
      if (p < 0.65) sweepBroom(ctx, from, to, p, s, fxPixel(L));
      if (p > 0.55) {
        burst(ctx, to.x, to.y, (p - 0.55) / 0.45, fxPixel(L), { rays: 10, len: 80 * s, colors: ['#fff7d6', '#ffd23f'], size: 3 });
        popText(ctx, '啪！', to.x + 38 * s, to.y - 68 * s, (p - 0.55) / 0.45, s, '#ffd23f');
      }
      break;
    case 'calc': {
      const formula = '120 x 2 = 240';
      const drawFormula = (x, y, text, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.font = `bold ${Math.max(22, Math.round(34 * s))}px "DotGothic16", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(4, 6 * s);
        ctx.strokeStyle = '#14121a';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = '#a6e05a';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      };
      if (p < 0.45) {
        const q = p / 0.45;
        const x = from.x + 60 * s;
        const y = from.y - 60 * s - Math.sin(q * Math.PI) * 14 * s;
        drawFormula(x, y, formula.slice(0, Math.floor(q * (formula.length + 1))));
      } else {
        const q = (p - 0.45) / 0.55;
        const t = Math.min(1, q * 1.15);
        const arc = Math.sin(t * Math.PI) * 70 * s;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t - 40 * s - arc;
        drawFormula(x, y - 10 * s, formula, 1 - Math.max(0, q - 0.9) / 0.1);
        if (q > 0.22) popText(ctx, '結帳！', to.x + 38 * s, to.y - 66 * s, (q - 0.22) / 0.78, s, '#ff4f7b');
      }
      break;
    }
    case 'chant':
      for (let i = 0; i < 2; i++) {
        const q = Math.min(1, Math.max(0, p * 1.15 - i * 0.22));
        if (q > 0) flyGrid(ctx, NOTE_GRID, from, to, q, s, fxPixel(L), 2, i === 0 ? -16 : 20);
      }
      if (p > 0.6) popText(ctx, '♫', to.x + 42 * s, to.y - 70 * s, (p - 0.6) / 0.4, s, '#8de2ff');
      break;
    case 'cake':
      fallGrid(ctx, CAKE_GRID, to, p, s, fxPixel(L));
      if (p > 0.55) {
        const q = (p - 0.55) / 0.45;
        healSparks(ctx, to, q, s, 6);
        popText(ctx, '＋', to.x + 40 * s, to.y - 70 * s, q, s, '#89ffb9');
      }
      break;
    case 'listen': {
      // an ear turned toward them, and what they say coming into it in rings
      const px = fxPixel(L);
      const earAt = { x: to.x - 70 * s, y: to.y + 40 * s };
      flyGrid(ctx, EAR_GRID, from, earAt, Math.min(1, p / 0.45), s, px, 3);
      if (p > 0.4) {
        const q = (p - 0.4) / 0.6;
        const ex = earAt.x + 6 * s;
        const ey = earAt.y - 40 * s;
        ctx.save();
        ctx.strokeStyle = '#bff2ff';
        ctx.lineWidth = px;
        for (let i = 0; i < 3; i++) {
          const r = 1 - ((q * 2 + i / 3) % 1);
          ctx.globalAlpha = Math.min(1, (1 - r) * 3) * (q > 0.85 ? (1 - q) / 0.15 : 1);
          ctx.beginPath();
          ctx.arc(ex, ey, (26 + r * 46) * s, -Math.PI * 0.28, Math.PI * 0.28);
          ctx.stroke();
        }
        ctx.restore();
        if (p > 0.6) healSparks(ctx, to, (p - 0.6) / 0.4, s, 5);
        popText(ctx, '嗯嗯', to.x + 44 * s, to.y - 62 * s, q, s, '#bff2ff');
      }
      break;
    }
    case 'rage':
      scatterSymbols(ctx, '＠＃＄％＠＄％＃＄％', from, p, s, '#89ffb9');
      calmAura(ctx, from, p, s);
      if (p > 0.5) popText(ctx, '同感！', to.x + 44 * s, to.y - 68 * s, (p - 0.5) / 0.5, s, '#89ffb9');
      break;
    case 'slam': {
      const tableY = to.y + 26 * s;
      const hit = Math.min(1, p / 0.42);
      const px = fxPixel(L);
      drawGrid(ctx, TABLE_GRID, to.x, tableY, px, 3);
      const fistY = tableY - 26 * s - (1 - hit) * 72 * s;
      const flat = p > 0.42 ? 1 - 0.35 * ((p - 0.42) / 0.58) : 1;
      ctx.save();
      ctx.translate(to.x, fistY);
      ctx.scale(1 + (1 - flat) * 0.4, flat);
      drawGrid(ctx, FIST_GRID, 0, 0, px, 3);
      ctx.restore();
      if (p > 0.42) {
        ctx.save();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2 * s;
        for (const side of [-1, 1]) {
          for (const dy of [-10, 10]) {
            ctx.beginPath();
            ctx.moveTo(to.x + side * 22 * s, tableY + dy * s);
            ctx.lineTo(to.x + side * (38 + (p - 0.42) * 16) * s, tableY + dy * s);
            ctx.stroke();
          }
        }
        ctx.restore();
        popText(ctx, '砰！', to.x + 34 * s, tableY - 60 * s, (p - 0.42) / 0.58, s, '#ffd23f');
      }
      break;
    }
    case 'shout':
      flyText(ctx, '！＃＄％＠＃＄＠＃＄', from, to, p, s, '#ff4f7b');
      if (p > 0.6) popText(ctx, '！？', to.x + 42 * s, to.y - 70 * s, (p - 0.6) / 0.4, s, '#ff4f7b');
      break;
    case 'boss':
      flyText(ctx, '叫你們老闆出來', from, to, p, s, '#ffd23f');
      floatMarks(ctx, ANGER_GRID, to, p, s, fxPixel(L), 4);
      if (p > 0.45) popText(ctx, '我就是老闆！', to.x, to.y - 92 * s, (p - 0.45) / 0.55, s, '#ff9a62');
      break;
    case 'review':
      flyGrid(ctx, STAR_GRID, from, to, p, s, fxPixel(L), 2);
      if (p > 0.6) popText(ctx, '★', to.x + 42 * s, to.y - 70 * s, (p - 0.6) / 0.4, s, '#cf8bff');
      break;
    case 'sigh':
      flyText(ctx, '唉……', from, to, p, s, '#8de2ff');
      break;
    case 'grumble':
      flyText(ctx, '＃＄％＠＃＄＠＃＄', from, to, p, s, '#ff9a62');
      break;
    case 'cry':
      for (let i = 0; i < 8; i++) {
        const q = (p + i / 8) % 1;
        ctx.save();
        ctx.globalAlpha = 1 - q;
        block(ctx, to.x + (i - 3.5) * 12 * s, to.y - 10 * s + q * 70 * s, fxPixel(L), fxPixel(L), '#8de2ff');
        ctx.restore();
      }
      flyText(ctx, '嗚……', from, to, p, s, '#8de2ff');
      break;
    case 'remember':
      flyText(ctx, '又想起那件事……', from, to, p, s, '#cf8bff');
      break;
    default: {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(to.x, to.y, 10 * s * p, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function drawHitFx(ctx, fx, p, L) {
  const at = targetPoint(L, fx.target);
  const s = L.scale;
  if (fx.heal) {
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4;
    ctx.fillStyle = '#89ffb9';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + p * 2;
      const r = (14 + (i % 3) * 9) * s;
      const x = at.x + Math.cos(a) * r;
      const y = at.y - 20 * s - p * 50 * s + Math.sin(a) * 10 * s;
      ctx.fillRect(x - s, y - 4 * s, 2 * s, 8 * s);
      ctx.fillRect(x - 4 * s, y - s, 8 * s, 2 * s);
    }
    ctx.restore();
  } else if (p < 0.4) {
    const px = fxPixel(L);
    const strong = fx.crit || fx.eff > 1;
    burst(ctx, at.x, at.y, p / 0.4, px, {
      rays: strong ? 12 : 8,
      len: (strong ? 80 : 56) * s,
      colors: fx.crit ? ['#fff7d6', '#ff4f7b'] : fx.eff > 1 ? ['#fff7d6', '#cf8bff'] : ['#fff7d6', '#ffd23f'],
      size: strong ? 3 : 2,
      spin: 0.2,
    });
  }
  ctx.save();
  ctx.globalAlpha = 1 - Math.max(0, p - 0.65) / 0.35;
  ctx.font = `bold ${Math.max(18, Math.round(26 * s))}px "DotGothic16", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grow = 1 + Math.sin(Math.min(1, p * 2) * Math.PI) * 0.25;
  ctx.translate(at.x, at.y - 28 * s - p * 26 * s);
  ctx.scale(grow, grow);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0b0910';
  ctx.fillStyle = fx.heal ? '#89ffb9' : fx.crit ? '#ff4f7b' : '#fff7d6';
  const text = `${fx.heal ? '+' : '-'}${fx.amount}`;
  ctx.strokeText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawFx(ctx, st, L, now) {
  const s = L.scale;
  for (const fx of st.fx) {
    const p = Math.max(0, Math.min(1, (now - fx.t0) / fx.dur));
    if (fx.kind === 'move') {
      drawMoveFx(ctx, fx, p, L);
    } else if (fx.kind === 'hit') {
      drawHitFx(ctx, fx, p, L);
    } else if (fx.kind === 'reflect') {
      const at = targetPoint(L, fx.target);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(at.x, at.y - 20 * s, (30 + p * 42) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (fx.kind === 'miss') {
      const at = targetPoint(L, fx.target);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.font = `bold ${Math.max(16, Math.round(22 * s))}px "DotGothic16", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9c1d9';
      ctx.fillText('MISS', at.x, at.y - 40 * s - p * 22 * s);
      ctx.restore();
    } else if (fx.kind === 'heal') {
      const at = targetPoint(L, 'player');
      ctx.save();
      ctx.fillStyle = 'rgba(137,255,185,.9)';
      for (let i = 0; i < 6; i++) {
        const ang = i * 1.4 - p * 2;
        const r = 32 * s * (0.4 + p * 0.8);
        const x = at.x + Math.cos(ang) * r;
        const y = at.y + Math.sin(ang) * r - p * 30 * s;
        ctx.fillRect(x - 2 * s, y - 8 * s, 4 * s, 16 * s);
        ctx.fillRect(x - 8 * s, y - 2 * s, 16 * s, 4 * s);
      }
      ctx.restore();
    } else if (fx.kind === 'tissue') {
      const from = targetPoint(L, fx.from ?? 'player');
      const to = targetPoint(L, fx.target ?? 'enemy');
      fxTissue(ctx, from, to, p, s, fxPixel(L));
    } else if (fx.kind === 'sign') {
      fxSign(ctx, L, p, fxPixel(L));
    } else if (fx.kind === 'signBlock') {
      fxSignBlock(ctx, L, p, fxPixel(L));
    } else if (fx.kind === 'guard') {
      const at = targetPoint(L, 'player');
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,63,.85)';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.arc(at.x, at.y, 54 * s, -Math.PI * 0.9, Math.PI * 0.9);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(191,242,255,.55)';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(at.x, at.y, 46 * s, -Math.PI * 0.8, Math.PI * 0.8);
      ctx.stroke();
      ctx.restore();
    } else if (fx.kind === 'cheer') {
      const at = targetPoint(L, 'enemy');
      ctx.save();
      ctx.fillStyle = '#89ffb9';
      for (let i = 0; i < 8; i++) {
        const q = (p + i / 8) % 1;
        const x = at.x + Math.sin(i * 2.4 + q * 4) * 54 * s;
        const y = at.y - 20 * s - q * 100 * s;
        ctx.globalAlpha = 1 - q;
        ctx.fillRect(x - s, y - 4 * s, 2 * s, 8 * s);
        ctx.fillRect(x - 4 * s, y - s, 8 * s, 2 * s);
      }
      ctx.restore();
      popText(ctx, '♪', at.x + 46 * s, at.y - 76 * s, p, s, '#89ffb9');
    } else if (fx.kind === 'roach') {
      const x = L.player.x - 140 * s + p * 300 * s;
      const y = L.bottom - 16 * s;
      ctx.save();
      ctx.fillStyle = '#1b120e';
      ctx.beginPath();
      ctx.ellipse(x, y, 10 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x - 2 * s, y - 7 * s, 4 * s, 4 * s);
      for (let i = -1; i <= 1; i += 2) {
        ctx.strokeStyle = '#1b120e';
        ctx.lineWidth = 1.5 * s;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.moveTo(x + i * 3 * s, y - 2 * s + j * 3 * s);
          ctx.lineTo(x + i * 10 * s, y - 7 * s + j * 4 * s);
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (fx.kind === 'run') {
      const at = targetPoint(L, 'player');
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = 'rgba(220,205,190,.45)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(at.x - 30 * s - p * 80 * s - i * 12 * s, at.y + 30 * s + i * 4 * s, (5 + i) * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function getPersonSprites(look, name, back) {
  const info = { ...ownerInfo(look, name), back };
  return {
    sprite: makeSprite(44, SPRITE_H, (g, pal) => drawOwner(g, pal, info), info.pal),
    white: makeSprite(44, SPRITE_H, (g, pal) => drawOwner(g, pal, info), whiten(info.pal)),
  };
}

// ---- 8-bit pass ------------------------------------------------------------
// Drawn like the spider and the owner: the room goes onto a coarse grid (one
// cell about the size of a sprite pixel), every cell snaps to the nearest
// colour of a small, muted palette, and wherever two areas meet the darker
// side gets a dark outline. Then it is scaled up with no smoothing.
// The room does not move, so all of this runs once per canvas size and the
// result is reused every frame.
const RETRO_PAL = [
  '#0f0e12', '#1f1d24', '#5f726f', '#9b9893', '#a9a59e', '#2e2c33', '#44424a', '#5c5a60', '#6c6a6e', '#7c7b7e', '#8e8c8e', '#a3a1a0', '#bab7b2', '#d6d2ca', '#f1ece0',
  '#2c2446', '#3d3361', '#4e437a', '#5f5590', '#7468a2',
  '#16282a', '#21393a', '#2d4a4a', '#3c605e', '#557a76',
  '#2a1a14', '#3f281d', '#58392a', '#77503a', '#9a704f', '#bf9a6e',
  '#5e2024', '#8e3330', '#b5473a', '#e0583f',
  '#c47a3a', '#d9aa4e', '#ecd58a',
  '#1f2b52', '#304a86', '#5a78b4',
  '#2f5a40', '#5b8a4c',
  '#a8456a', '#dd7f9c',
].map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
const retroCache = new Map();
function retroColor(r, g, b) {
  const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let hit = retroCache.get(key);
  if (!hit) {
    let best = Infinity;
    for (const p of RETRO_PAL) {
      const dr = r - p[0];
      const dg = g - p[1];
      const db = b - p[2];
      const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (dist < best) {
        best = dist;
        hit = p;
      }
    }
    retroCache.set(key, hit);
  }
  return hit;
}
const OUTLINE_EDGE = 70; // summed RGB difference that counts as an edge
const OUTLINE_SHADE = 0.5;
let roomPix = null;

function renderRoomPixels(w, h, t, L, P) {
  const lw = Math.ceil(w / P);
  const lh = Math.ceil(h / P);
  const buf = document.createElement('canvas');
  buf.width = lw;
  buf.height = lh;
  const g = buf.getContext('2d', { willReadFrequently: true });
  g.setTransform(1 / P, 0, 0, 1 / P, 0, 0);
  const neon = drawRoom(g, w, h, t, L, { neonText: false });
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, lw, lh);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const c = retroColor(px[i], px[i + 1], px[i + 2]);
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  }
  const src = new Uint8ClampedArray(px);
  const lum = (i) => src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11;
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const i = (y * lw + x) * 4;
      const li = lum(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= lw || ny >= lh) continue;
        const j = (ny * lw + nx) * 4;
        const diff = Math.abs(src[i] - src[j]) + Math.abs(src[i + 1] - src[j + 1]) + Math.abs(src[i + 2] - src[j + 2]);
        if (diff > OUTLINE_EDGE && li < lum(j)) {
          const c = retroColor(src[i] * OUTLINE_SHADE, src[i + 1] * OUTLINE_SHADE, src[i + 2] * OUTLINE_SHADE);
          px[i] = c[0];
          px[i + 1] = c[1];
          px[i + 2] = c[2];
          break;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return { key: `${w}x${h}x${P}`, buf, neon, P };
}

function drawRoomPixel(ctx, w, h, t, L) {
  const P = Math.max(2, Math.round(L.scale * 4));
  if (!roomPix || roomPix.key !== `${w}x${h}x${P}x${L.bottom}`) roomPix = renderRoomPixels(w, h, t, L, P);
  const { buf, neon } = roomPix;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, buf.width * P, buf.height * P);
  ctx.restore();
  // the sign's lettering is too small to survive the coarse grid, so it is
  // drawn on top in the pixel font at full size
  drawNeonText(ctx, neon.nx, neon.ny, neon.nr);
}

export function createScene({ owner, customer, mode } = {}) {
  const isCustomer = mode === 'rude' || mode === 'kind';
  const enemyArt = isCustomer && customer?.look
    ? getPersonSprites(customer.look, customer.name, false)
    : getSpiderSprites();
  const ownerArt = getPersonSprites(owner?.look, owner?.name, true);
  const art = {
    spider: enemyArt.sprite,
    spiderWhite: enemyArt.white,
    owner: ownerArt.sprite,
    ownerWhite: ownerArt.white,
  };
  return {
    draw(ctx, w, h, st, dockPx = 0) {
      const now = performance.now();
      const L = layout(w, h, dockPx);
      const px = fxPixel(L);

      // shake the whole picture on a hit: harder for crits and super-effective
      let sx = 0;
      let sy = 0;
      for (const fx of st.fx) {
        if (fx.kind !== 'hit' || fx.heal) continue;
        const p = (now - fx.t0) / fx.dur;
        if (p >= 0.4) continue;
        const amp = (fx.crit ? 16 : fx.eff > 1 ? 12 : 7) * L.scale * (1 - p / 0.4);
        sx += Math.sin(now * 0.09) * amp;
        sy += Math.cos(now * 0.13) * amp * 0.6;
      }
      ctx.fillStyle = '#08080a';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(Math.round(sx / px) * px, Math.round(sy / px) * px);

      drawRoomPixel(ctx, w, h, st.t, L);

      // the attacker steps in toward the target as the move starts
      const lunge = (who) => {
        const base = L[who];
        const fx = st.fx.find((f) => f.kind === 'move' && f.from === who);
        if (!fx) return base;
        const p = (now - fx.t0) / fx.dur;
        if (p > 0.3) return base;
        const other = L[who === 'player' ? 'enemy' : 'player'];
        const k = Math.sin((p / 0.3) * Math.PI) * 30 * L.scale;
        const dx = other.x - base.x;
        const dy = other.y - base.y;
        const n = Math.hypot(dx, dy) || 1;
        return { x: base.x + (dx / n) * k, y: base.y + (dy / n) * k };
      };


      const enemyHit = st.fx.find(
        (fx) => fx.kind === 'hit' && !fx.heal && fx.target === 'enemy' && now - fx.t0 < fx.dur
      );
      const playerHit = st.fx.find(
        (fx) => fx.kind === 'hit' && !fx.heal && fx.target === 'player' && now - fx.t0 < fx.dur
      );

      drawSprite(
        ctx,
        art.spider,
        art.spiderWhite,
        lunge('enemy'),
        L.scale * (isCustomer ? 3.9 : 3.4),
        st.reveal.enemy,
        st.fainted.enemy,
        enemyHit,
        now,
        -1
      );
      drawSprite(
        ctx,
        art.owner,
        art.ownerWhite,
        lunge('player'),
        L.scale * 4.1,
        st.reveal.player,
        st.fainted.player,
        playerHit,
        now,
        1
      );

      // the sign stays planted in front of the owner until it takes a hit (its drop and its fall are effects of their own)
      if (st.itemGuard && !st.fx.some((fx) => fx.kind === 'sign')) {
        const { x, ground } = signSpot(L);
        drawStandSign(ctx, x, ground, px, L.scale);
      }
      drawFx(ctx, st, L, now);
      if (st.guard || st.soften) {
        const at = targetPoint(L, 'player');
        const pulse = 0.85 + Math.sin(now * 0.008) * 0.15;
        const aura = st.soften ? '#fff7d6' : '#ffd23f';
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = aura;
        ctx.lineWidth = 4 * L.scale;
        ctx.beginPath();
        ctx.arc(at.x, at.y, 54 * L.scale, -Math.PI * 0.9, Math.PI * 0.9);
        ctx.stroke();
        ctx.strokeStyle = st.soften ? 'rgba(255,247,214,.75)' : 'rgba(191,242,255,.7)';
        ctx.lineWidth = 2 * L.scale;
        ctx.beginPath();
        ctx.arc(at.x, at.y, 46 * L.scale, -Math.PI * 0.8, Math.PI * 0.8);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      for (const fx of st.fx) {
        if (fx.kind === 'hit' && !fx.heal) {
          const p = (now - fx.t0) / fx.dur;
          if (p < 0.25) {
            const a = (fx.crit || fx.eff > 1 ? 0.26 : 0.15) * (1 - p / 0.25);
            ctx.fillStyle = fx.eff > 1 ? `rgba(207,139,255,${a})` : `rgba(255,255,255,${a})`;
            ctx.fillRect(0, 0, w, h);
          }
        }
      }
    },
    dispose() {
      spiderSprites = null;
    },
  };
}
