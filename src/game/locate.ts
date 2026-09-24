/** Light face of a badge, measured on the template art, excluding the dark role bar. */
const BAR_OVER_FACE = 118 / 625;
const ANALYSIS_WIDTH = 180;
const MIN_AREA = 0.015;
const MAX_COVERAGE = 0.92;
const OUTSET = 0.015;

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];

function drawScaled(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, dw);
  canvas.height = Math.max(1, dh);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function luminance(image: ImageData): Float32Array {
  const { data } = image;
  const luma = new Float32Array(data.length / 4);
  for (let i = 0; i < luma.length; i += 1) {
    const j = i * 4;
    luma[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  return luma;
}

function otsu(luma: Float32Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < luma.length; i += 1) hist[Math.min(255, luma[i] | 0)] += 1;
  const total = luma.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i += 1) sumAll += i * hist[i];
  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let thresh = 128;
  for (let i = 0; i < 256; i += 1) {
    weightB += hist[i];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += i * hist[i];
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) ** 2;
    if (between > best) {
      best = between;
      thresh = i;
    }
  }
  return thresh;
}

function largestComponent(mask: Uint8Array, width: number, height: number): number[] {
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  let best: number[] = [];
  const visit = (index: number) => {
    if (mask[index] && !seen[index]) {
      seen[index] = 1;
      stack.push(index);
    }
  };
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || seen[i]) continue;
    stack.length = 0;
    seen[i] = 1;
    stack.push(i);
    const component: number[] = [];
    while (stack.length) {
      const index = stack.pop() as number;
      component.push(index);
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }
    if (component.length > best.length) best = component;
  }
  return best;
}

function cross(origin: Point, a: Point, b: Point): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function convexHull(points: Point[]): Point[] {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 2) return sorted;
  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function boundaryPoints(
  component: number[],
  mask: Uint8Array,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
): Point[] {
  const points: Point[] = [];
  for (let n = 0; n < component.length; n += 1) {
    const index = component[n];
    const x = index % width;
    const y = (index - x) / width;
    const open =
      x === 0 ||
      y === 0 ||
      x + 1 === width ||
      y + 1 === height ||
      !mask[index - 1] ||
      !mask[index + 1] ||
      !mask[index - width] ||
      !mask[index + width];
    if (!open) continue;
    points.push({ x: (x + 0.5) * scaleX, y: (y + 0.5) * scaleY });
  }
  return points;
}

function quadFromHull(points: Point[]): Quad | null {
  if (points.length < 4) return null;
  let topLeft = points[0];
  let topRight = points[0];
  let bottomRight = points[0];
  let bottomLeft = points[0];
  for (const point of points) {
    if (point.x + point.y < topLeft.x + topLeft.y) topLeft = point;
    if (point.x - point.y > topRight.x - topRight.y) topRight = point;
    if (point.x + point.y > bottomRight.x + bottomRight.y) bottomRight = point;
    if (point.x - point.y < bottomLeft.x - bottomLeft.y) bottomLeft = point;
  }
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function extendBottom(quad: Quad): Quad {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const push = (top: Point, bottom: Point): Point => ({
    x: bottom.x + (bottom.x - top.x) * BAR_OVER_FACE,
    y: bottom.y + (bottom.y - top.y) * BAR_OVER_FACE,
  });
  return [topLeft, topRight, push(topRight, bottomRight), push(topLeft, bottomLeft)];
}

function outset(quad: Quad, fraction: number): Quad {
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
  const scale = 1 + fraction;
  return quad.map((point) => ({
    x: cx + (point.x - cx) * scale,
    y: cy + (point.y - cy) * scale,
  })) as Quad;
}

function quadArea(quad: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function quadValid(quad: Quad, width: number, height: number): boolean {
  const keys = new Set(quad.map((point) => `${Math.round(point.x)}:${Math.round(point.y)}`));
  if (keys.size < 4) return false;
  const area = quadArea(quad);
  if (area < MIN_AREA * width * height) return false;
  const topY = (quad[0].y + quad[1].y) / 2;
  const bottomY = (quad[2].y + quad[3].y) / 2;
  if (bottomY <= topY + height * 0.2) return false;
  const topWidth = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
  const sideHeight = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
  const aspect = sideHeight === 0 ? 0 : topWidth / sideHeight;
  if (aspect < 0.35 || aspect > 1.05) return false;
  const slackX = width * 0.12;
  const slackY = height * 0.12;
  if (quad.some((point) => point.x < -slackX || point.y < -slackY || point.x > width + slackX || point.y > height + slackY)) {
    return false;
  }
  const minX = Math.min(...quad.map((point) => point.x));
  const maxX = Math.max(...quad.map((point) => point.x));
  const minY = Math.min(...quad.map((point) => point.y));
  const maxY = Math.max(...quad.map((point) => point.y));
  const coverage = ((maxX - minX) * (maxY - minY)) / (width * height);
  return coverage <= MAX_COVERAGE;
}

type Analysis = {
  luma: Float32Array;
  light: Uint8Array;
  aw: number;
  ah: number;
  scaleX: number;
  scaleY: number;
};

function analyze(source: HTMLCanvasElement): Analysis | null {
  const sw = source.width;
  const sh = source.height;
  if (sw < 20 || sh < 20) return null;
  const aw = Math.min(ANALYSIS_WIDTH, sw);
  const ah = Math.max(1, Math.round((sh / sw) * aw));
  const analysis = drawScaled(source, 0, 0, sw, sh, aw, ah);
  const ctx = analysis.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const luma = luminance(ctx.getImageData(0, 0, aw, ah));
  const thresh = otsu(luma);
  const light = new Uint8Array(luma.length);
  for (let i = 0; i < luma.length; i += 1) light[i] = luma[i] > thresh ? 1 : 0;
  return { luma, light, aw, ah, scaleX: sw / aw, scaleY: sh / ah };
}

function locateLightFace(source: HTMLCanvasElement, view: Analysis): Quad | null {
  const { light, aw, ah, scaleX, scaleY } = view;
  const component = largestComponent(light, aw, ah);
  if (component.length < MIN_AREA * aw * ah) return null;
  const face = quadFromHull(convexHull(boundaryPoints(component, light, aw, ah, scaleX, scaleY)));
  if (!face) return null;
  const quad = outset(extendBottom(face), OUTSET);
  return quadValid(quad, source.width, source.height) ? quad : null;
}

const CARD_HEIGHT_OVER_WIDTH = 743 / 494;

function locateRoleBar(source: HTMLCanvasElement, view: Analysis): Quad | null {
  const { luma, light, aw, ah, scaleX, scaleY } = view;
  const dark = new Uint8Array(light.length);
  for (let i = 0; i < light.length; i += 1) dark[i] = light[i] ? 0 : 1;
  const seen = new Uint8Array(dark.length);
  const stack: number[] = [];
  let best: { width: number; quad: Quad } | null = null;
  const visit = (index: number) => {
    if (dark[index] && !seen[index]) {
      seen[index] = 1;
      stack.push(index);
    }
  };
  for (let i = 0; i < dark.length; i += 1) {
    if (!dark[i] || seen[i]) continue;
    stack.length = 0;
    seen[i] = 1;
    stack.push(i);
    let minX = aw;
    let maxX = 0;
    let minY = ah;
    let maxY = 0;
    let count = 0;
    while (stack.length) {
      const index = stack.pop() as number;
      count += 1;
      const x = index % aw;
      const y = (index - x) / aw;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0) visit(index - 1);
      if (x + 1 < aw) visit(index + 1);
      if (y > 0) visit(index - aw);
      if (y + 1 < ah) visit(index + aw);
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (bw < aw * 0.18 || bh < 3) continue;
    const aspect = bw / bh;
    if (aspect < 2.6 || aspect > 8) continue;
    if (count > aw * ah * 0.22) continue;
    let letters = 0;
    let box = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        box += 1;
        if (luma[y * aw + x] > 150) letters += 1;
      }
    }
    const letterFrac = box === 0 ? 0 : letters / box;
    if (letterFrac < 0.06 || letterFrac > 0.55) continue;
    const aboveY = Math.max(0, minY - bh * 2);
    let above = 0;
    let aboveCount = 0;
    for (let y = aboveY; y < minY; y += 1) {
      for (let x = minX; x <= maxX; x += 2) {
        above += luma[y * aw + x];
        aboveCount += 1;
      }
    }
    if (aboveCount === 0 || above / aboveCount < 140) continue;
    const left = minX * scaleX;
    const right = (maxX + 1) * scaleX;
    const bottom = (maxY + 1) * scaleY;
    const width = right - left;
    const top = bottom - width * CARD_HEIGHT_OVER_WIDTH;
    const quad = outset(
      [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      ],
      OUTSET,
    );
    if (!quadValid(quad, source.width, source.height)) continue;
    if (!best || width > best.width) best = { width, quad };
  }
  return best?.quad ?? null;
}

/**
 * Finds the badge when it does not fill the frame.
 * Prefers the light card face, whose bottom edge is the top of the role bar, so a
 * tilted card on a dark background still yields four corners. If that face blends
 * into a light background, the dark role bar is used instead. Returns null when the
 * card already fills the frame — that path keeps the plain crop.
 */
export function locateCard(source: HTMLCanvasElement): Quad | null {
  const view = analyze(source);
  if (!view) return null;
  return locateLightFace(source, view) ?? locateRoleBar(source, view);
}

function homography(from: Quad, to: Quad): number[] | null {
  const rows: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = from[i];
    const X = to[i].x;
    const Y = to[i].y;
    rows.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
    rows.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
  }
  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 8; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (Math.abs(rows[pivot][col]) < 1e-8) return null;
    const hold = rows[col];
    rows[col] = rows[pivot];
    rows[pivot] = hold;
    const divisor = rows[col][col];
    for (let j = col; j < 9; j += 1) rows[col][j] /= divisor;
    for (let row = 0; row < 8; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let j = col; j < 9; j += 1) rows[row][j] -= factor * rows[col][j];
    }
  }
  return rows.map((row) => row[8]);
}

export function warpCard(
  source: HTMLCanvasElement,
  quad: Quad,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const srcCtx = source.getContext("2d", { willReadFrequently: true });
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const outCtx = out.getContext("2d");
  if (!srcCtx || !outCtx) return null;
  const sw = source.width;
  const sh = source.height;
  const src = srcCtx.getImageData(0, 0, sw, sh).data;
  const dest = outCtx.createImageData(width, height);
  const pixels = dest.data;
  const map = homography(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    quad,
  );
  if (!map) return null;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = map;
  const clamp = (value: number, max: number) => (value < 0 ? 0 : value > max ? max : value);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const den = h6 * x + h7 * y + 1;
      if (!Number.isFinite(den) || Math.abs(den) < 1e-6) continue;
      const sx = (h0 * x + h1 * y + h2) / den;
      const sy = (h3 * x + h4 * y + h5) / den;
      const x0 = clamp(Math.floor(sx), sw - 1);
      const y0 = clamp(Math.floor(sy), sh - 1);
      const x1 = clamp(x0 + 1, sw - 1);
      const y1 = clamp(y0 + 1, sh - 1);
      const dx = sx - Math.floor(sx);
      const dy = sy - Math.floor(sy);
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] =
          src[i00 + channel] * (1 - dx) * (1 - dy) +
          src[i10 + channel] * dx * (1 - dy) +
          src[i01 + channel] * (1 - dx) * dy +
          src[i11 + channel] * dx * dy;
      }
      pixels[offset + 3] = 255;
    }
  }
  outCtx.putImageData(dest, 0, 0);
  return out;
}

/** True when the straightened canvas still has a dark role bar with light lettering. */
export function cardHasRoleBar(card: HTMLCanvasElement): boolean {
  const ctx = card.getContext("2d", { willReadFrequently: true });
  if (!ctx || card.width === 0 || card.height === 0) return false;
  const { data, width, height } = ctx.getImageData(0, 0, card.width, card.height);
  const lumaAt = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
  };
  let face = 0;
  let faceCount = 0;
  let bar = 0;
  let barCount = 0;
  let letters = 0;
  const faceStart = Math.floor(height * 0.42);
  const faceEnd = Math.floor(height * 0.58);
  const barStart = Math.floor(height * 0.84);
  for (let y = faceStart; y < faceEnd; y += 2) {
    for (let x = 0; x < width; x += 3) {
      face += lumaAt(x, y);
      faceCount += 1;
    }
  }
  for (let y = barStart; y < height; y += 2) {
    for (let x = 0; x < width; x += 3) {
      const value = lumaAt(x, y);
      bar += value;
      barCount += 1;
      if (value > 150) letters += 1;
    }
  }
  if (faceCount === 0 || barCount === 0) return false;
  const faceMean = face / faceCount;
  const barMean = bar / barCount;
  const letterFrac = letters / barCount;
  return faceMean > 90 && barMean < faceMean - 30 && letterFrac > 0.05 && letterFrac < 0.55;
}
