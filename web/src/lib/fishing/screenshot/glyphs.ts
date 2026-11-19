import type { RGBAImage } from "./types";

export const GW = 10;
export const GH = 14;

export interface Glyph {
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number;
  /** GW*GH soft bitmap, 0..1 */
  bits: number[];
}

/** Soft "whiteness" 0..1 from the min channel (white text fill vs. coloured sprite / blue face). */
function white(data: ArrayLike<number>, i: number): number {
  const m = Math.min(data[i], data[i + 1], data[i + 2]);
  // text is neutral (white/grey); the light-blue frame and coloured sprites are not
  if (Math.max(data[i], data[i + 1], data[i + 2]) - m > 48) return 0;
  const v = (m - 120) / 100;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

interface Comp {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  n: number;
}

/**
 * Extract candidate glyphs (white connected components) from a cell's lower strip.
 * Returns glyphs sorted left to right, filtered to the dominant text line.
 */
export function extractGlyphs(
  img: RGBAImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Glyph[] {
  const { width: W, data } = img;
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return [];
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) mask[y * w + x] = white(data, ((y0 + y) * W + (x0 + x)) * 4) >= 0.22 ? 1 : 0;

  // 8-connected components
  const seen = new Uint8Array(w * h);
  const comps: Comp[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    const c: Comp = { x0: w, y0: h, x1: 0, y1: 0, n: 0 };
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % w;
      const py = (p - px) / w;
      c.n++;
      if (px < c.x0) c.x0 = px;
      if (py < c.y0) c.y0 = py;
      if (px + 1 > c.x1) c.x1 = px + 1;
      if (py + 1 > c.y1) c.y1 = py + 1;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
    }
    comps.push(c);
  }

  const cellSize = w; // caller passes a strip about as wide as the cell
  // Re-join pieces of one glyph that anti-aliasing split vertically (e.g. a "9" cut at its bowl).
  const small = (c: Comp) => c.x1 - c.x0 <= cellSize * 0.3 && c.y1 - c.y0 <= cellSize * 0.34;
  for (let again = true; again; ) {
    again = false;
    outer: for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        const a = comps[i];
        const b = comps[j];
        if (!small(a) || !small(b)) continue;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const gy = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
        if (ox >= 0.5 * Math.min(a.x1 - a.x0, b.x1 - b.x0) && gy <= 2) {
          a.x0 = Math.min(a.x0, b.x0);
          a.y0 = Math.min(a.y0, b.y0);
          a.x1 = Math.max(a.x1, b.x1);
          a.y1 = Math.max(a.y1, b.y1);
          a.n += b.n;
          comps.splice(j, 1);
          again = true;
          break outer;
        }
      }
    }
  }
  // text-height candidates: tall enough to be digits
  const tall = comps.filter((c) => c.y1 - c.y0 >= cellSize * 0.1 && c.y1 - c.y0 <= cellSize * 0.34 && c.x1 - c.x0 <= cellSize * 0.3);
  if (tall.length === 0) return [];
  const hMed = [...tall.map((c) => c.y1 - c.y0)].sort((a, b) => a - b)[Math.floor(tall.length / 2)];
  const sameSize = tall.filter((c) => Math.abs(c.y1 - c.y0 - hMed) <= 0.25 * hMed);
  // dominant baseline: cluster by bottom edge
  let bestGroup: Comp[] = [];
  for (const a of sameSize) {
    const g = sameSize.filter((b) => Math.abs(b.y1 - a.y1) <= 0.2 * hMed);
    if (g.length > bestGroup.length || (g.length === bestGroup.length && g.length && Math.max(...g.map((c) => c.x1)) > Math.max(...bestGroup.map((c) => c.x1)))) bestGroup = g;
  }
  const textH = hMed;
  const bottom = Math.max(...bestGroup.map((c) => c.y1));
  const top = Math.min(...bestGroup.map((c) => c.y0));
  // small marks (decimal point) sitting on the baseline
  const dots = comps.filter(
    (c) =>
      c.y1 - c.y0 <= 0.45 * textH &&
      c.x1 - c.x0 <= 0.45 * textH &&
      c.y1 - c.y0 >= 0.12 * textH &&
      Math.abs(c.y1 - bottom) <= 0.2 * textH &&
      bestGroup.length > 0 &&
      c.x0 > Math.min(...bestGroup.map((g) => g.x0)) &&
      c.x1 < Math.max(...bestGroup.map((g) => g.x1)),
  );
  const chosen = [...bestGroup, ...dots].sort((a, b) => a.x0 - b.x0);
  void top;
  return chosen.map((c) => {
    const bits = new Array<number>(GW * GH).fill(0);
    const cw = c.x1 - c.x0;
    const ch = c.y1 - c.y0;
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        // area-average over the source box of this grid cell
        const sx0 = c.x0 + (gx * cw) / GW;
        const sx1 = c.x0 + ((gx + 1) * cw) / GW;
        const sy0 = c.y0 + (gy * ch) / GH;
        const sy1 = c.y0 + ((gy + 1) * ch) / GH;
        let sum = 0;
        let area = 0;
        for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
          const wy = Math.min(y + 1, sy1) - Math.max(y, sy0);
          for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
            const wx = Math.min(x + 1, sx1) - Math.max(x, sx0);
            const wt = wx * wy;
            sum += wt * white(data, ((y0 + y) * W + (x0 + x)) * 4);
            area += wt;
          }
        }
        bits[gy * GW + gx] = area > 0 ? sum / area : 0;
      }
    }
    return { x0: x0 + c.x0, y0: y0 + c.y0, x1: x0 + c.x1, y1: y0 + c.y1, bits };
  });
}

/** True when the cell face contains (almost) nothing except face colour and dark pixels, i.e. a "?" cell. */
export function looksUndiscovered(img: RGBAImage, x0: number, y0: number, x1: number, y1: number): boolean {
  const { width: W, data } = img;
  let other = 0;
  let total = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      total++;
      const face = b >= 2 * r && b >= 1.6 * g && b > 70;
      const dark = Math.max(r, g, b) < 90;
      if (!face && !dark) other++;
    }
  return total > 0 && other / total < 0.03;
}
