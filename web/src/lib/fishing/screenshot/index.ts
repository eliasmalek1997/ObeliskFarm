import { ALL_FISH } from "../constants";
import { readAquariumScreenshot } from "./read";
import type { FishCellResult, GridInfo, RGBAImage } from "./types";

export * from "./types";
export { readAquariumScreenshot } from "./read";
export { locateGrid } from "./grid";

/** Fish per aquarium row (one dock per row). */
export const FISH_PER_ROW = 4;

export function fishIdAt(row: number, col: number, firstRowDock: number): string | null {
  return ALL_FISH[(firstRowDock + row) * FISH_PER_ROW + col]?.id ?? null;
}

export function readScreenshotForFish(
  img: RGBAImage,
  firstRowDock = 0,
): { grid: GridInfo; cells: FishCellResult[] } | null {
  const r = readAquariumScreenshot(img);
  if (!r) return null;
  return {
    grid: r.grid,
    cells: r.cells.map((c) => ({ ...c, fishId: fishIdAt(c.row, c.col, firstRowDock) })),
  };
}
