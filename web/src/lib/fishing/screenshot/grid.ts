import type { GridInfo, RGBAImage } from "./types";

/** Dark-blue cell face colour, roughly (43,46,141); tolerant to JPEG noise. */
function isFace(r: number, g: number, b: number): boolean {
  return b >= 90 && b <= 210 && r <= 95 && g <= 95 && b >= 2 * r && b >= 1.8 * g;
}

interface Run {
  a: number;
  b: number; // exclusive
}

function runs(proj: number[], thr: number, mergeGap: number): Run[] {
  const out: Run[] = [];
  let start = -1;
  for (let i = 0; i <= proj.length; i++) {
    const on = i < proj.length && proj[i] >= thr;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      out.push({ a: start, b: i });
      start = -1;
    }
  }
  const merged: Run[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r.a - last.b <= mergeGap) last.b = r.b;
    else merged.push({ ...r });
  }
  return merged;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Find 4 equally sized, equally spaced runs among candidates. */
function pickColumns(rs: Run[]): Run[] | null {
  const minW = 8;
  const cand = rs.filter((r) => r.b - r.a >= minW);
  if (cand.length < 4) return null;
  for (let i = 0; i + 4 <= cand.length; i++) {
    const g = cand.slice(i, i + 4);
    const w = median(g.map((r) => r.b - r.a));
    if (g.some((r) => Math.abs(r.b - r.a - w) > 0.15 * w)) continue;
    const pitch = (g[3].a - g[0].a) / 3;
    if (pitch < w * 1.02 || pitch > w * 1.6) continue;
    if (g.some((r, k) => Math.abs(r.a - (g[0].a + k * pitch)) > 0.08 * w)) continue;
    return g;
  }
  return null;
}

export function locateGrid(img: RGBAImage): GridInfo | null {
  const { width: W, height: H, data } = img;
  const face = new Uint8Array(W * H);
  const colProj = new Array<number>(W).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isFace(data[i], data[i + 1], data[i + 2])) {
        face[y * W + x] = 1;
        colProj[x]++;
      }
    }
  }
  const maxC = Math.max(...colProj);
  if (maxC < 20) return null;

  let cols: Run[] | null = null;
  for (const f of [0.4, 0.3, 0.5, 0.2, 0.6, 0.15]) {
    const rs = runs(colProj, maxC * f, Math.max(1, Math.round(W * 0.003)));
    cols = pickColumns(rs);
    if (cols) break;
  }
  if (!cols) return null;
  const S = median(cols.map((c) => c.b - c.a));

  // row projection restricted to the columns
  const rowProj = new Array<number>(H).fill(0);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (const c of cols) for (let x = c.a; x < c.b; x++) n += face[y * W + x];
    rowProj[y] = n;
  }
  const maxR = Math.max(...rowProj);
  if (maxR === 0) return null;

  for (const f of [0.1, 0.15, 0.06, 0.25]) {
    const rs = runs(rowProj, maxR * f, Math.max(1, Math.round(S * 0.04)));
    const full = rs.filter((r) => r.b - r.a >= 0.88 * S && r.b - r.a <= 1.2 * S);
    if (full.length === 0) continue;
    // longest chain with a consistent pitch
    let best: Run[] = [];
    for (let i = 0; i < full.length; i++) {
      const chain = [full[i]];
      for (let j = i + 1; j < full.length; j++) {
        const gap = full[j].a - chain[chain.length - 1].b;
        if (gap > 0.05 * S && gap < 0.45 * S) chain.push(full[j]);
        else if (gap >= 0.45 * S) break;
      }
      if (chain.length > best.length) best = chain;
    }
    if (best.length === 0) continue;
    const first = best[0];
    const last = best[best.length - 1];
    const partial = (r: Run) => r.b - r.a >= 0.12 * S && r.b - r.a < 0.88 * S;
    const topCut = rs.some((r) => partial(r) && r.b <= first.a && first.a - r.b < 0.45 * S);
    const bottomCut = rs.some((r) => partial(r) && r.a >= last.b && r.a - last.b < 0.45 * S);
    return {
      cols: cols.map((c) => [c.a, c.b] as [number, number]),
      // bottoms are the most reliable edge (sprites / selection tint can eat into the top)
      rows: best.map((r) => [Math.round(r.b - S), r.b] as [number, number]),
      cellSize: S,
      topCut,
      bottomCut,
    };
  }
  return null;
}
