import { extractGlyphs, GH, GW, looksUndiscovered, type Glyph } from "./glyphs";
import { locateGrid } from "./grid";
import { GLYPH_TEMPLATES } from "./templates";
import type { CellReading, RGBAImage, ScreenshotReading } from "./types";

/** Mean squared difference above which a glyph is "not a known digit". */
export const MAX_GLYPH_DIST = 0.06;
/** Distance scale that maps to confidence 0 for the best match. */
const DIST_SCALE = 0.05;
/** Margin between best and second best that counts as fully unambiguous. */
const MARGIN_SCALE = 0.02;

function blur(a: number[]): number[] {
  const out = new Array<number>(a.length);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      let s = 0;
      let wsum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const w = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
          s += w * a[ny * GW + nx];
          wsum += w;
        }
      out[y * GW + x] = s / wsum;
    }
  return out;
}

let blurredTemplates: [string, number[]][] | null = null;
function templates(): [string, number[]][] {
  blurredTemplates ??= Object.entries(GLYPH_TEMPLATES).map(([ch, t]) => [ch, blur(t)]);
  return blurredTemplates;
}

function dist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s / a.length;
}

export function classifyGlyph(bits: number[]): { ch: string; confidence: number; dist: number } {
  let best = "";
  let d1 = Infinity;
  let d2 = Infinity;
  const b = blur(bits);
  for (const [ch, t] of templates()) {
    const d = dist(b, t);
    if (d < d1) {
      d2 = d1;
      d1 = d;
      best = ch;
    } else if (d < d2) d2 = d;
  }
  if (!best || d1 > MAX_GLYPH_DIST) return { ch: "?", confidence: 0, dist: d1 };
  const fit = Math.max(0, 1 - d1 / DIST_SCALE);
  const margin = Math.min(1, (d2 - d1) / MARGIN_SCALE);
  return { ch: best, confidence: Math.max(0, Math.min(1, fit * 0.5 + margin * 0.5)), dist: d1 };
}

export function readCount(glyphs: Glyph[]): { raw: string; value: number | null; confidence: number } {
  if (glyphs.length === 0) return { raw: "", value: null, confidence: 0 };
  const maxH = Math.max(...glyphs.map((g) => g.y1 - g.y0));
  let raw = "";
  let conf = 1;
  for (const g of glyphs) {
    if (g.y1 - g.y0 < 0.5 * maxH) {
      raw += ".";
      conf = Math.min(conf, 0.4); // decimal / suffix formats: never trust blindly
      continue;
    }
    const c = classifyGlyph(g.bits);
    raw += c.ch;
    conf = Math.min(conf, c.confidence);
  }
  if (!/^\d+$/.test(raw)) return { raw, value: null, confidence: 0 };
  return { raw, value: Number(raw), confidence: conf };
}

/** Read every fully visible cell of the Aquarium grid in a screenshot. Returns null when no grid is found. */
export function readAquariumScreenshot(img: RGBAImage): ScreenshotReading | null {
  const grid = locateGrid(img);
  if (!grid) return null;
  const cells: CellReading[] = [];
  grid.rows.forEach(([ry0, ry1], row) => {
    grid.cols.forEach(([cx0, cx1], col) => {
      const x0 = Math.max(0, cx0);
      const x1 = Math.min(img.width, cx1);
      const pad = Math.round(0.03 * grid.cellSize);
      const y0 = Math.max(0, ry0);
      const y1 = Math.min(img.height, ry1);
      if (looksUndiscovered(img, x0, y0, x1, y1)) {
        cells.push({ row, col, kind: "undiscovered", value: null, confidence: 1, raw: "" });
        return;
      }
      const glyphs = extractGlyphs(img, Math.max(0, x0 - pad), Math.round(y0 + 0.5 * (y1 - y0)), Math.min(img.width, x1 + pad), Math.min(img.height, y1 + pad));
      const r = readCount(glyphs);
      cells.push({
        row,
        col,
        kind: r.value === null ? "unreadable" : "count",
        value: r.value,
        confidence: r.confidence,
        raw: r.raw,
      });
    });
  });
  return { grid, cells };
}
