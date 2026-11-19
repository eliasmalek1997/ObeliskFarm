/** Plain RGBA pixel buffer (same shape as the browser's ImageData); lets the algorithm run in Node tests. */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface Rect {
  x0: number;
  y0: number;
  /** exclusive */
  x1: number;
  y1: number;
}

export interface GridInfo {
  /** 4 column x ranges (cell face, exclusive end). */
  cols: [number, number][];
  /** Fully visible rows, top to bottom. */
  rows: [number, number][];
  /** Median cell width in px. */
  cellSize: number;
  /** True when a partially visible row sits above the first full row (grid is scrolled). */
  topCut: boolean;
  /** True when a partially visible row sits below the last full row. */
  bottomCut: boolean;
}

export type CellKind = "count" | "undiscovered" | "unreadable";

export interface CellReading {
  /** Row index among fully visible rows (0 = first full row). */
  row: number;
  col: number;
  kind: CellKind;
  /** Parsed count; null for undiscovered / unreadable cells. */
  value: number | null;
  /** 0..1 */
  confidence: number;
  /** Raw text as read ("?" marks an unknown glyph, "" for undiscovered). */
  raw: string;
}

export interface ScreenshotReading {
  grid: GridInfo;
  cells: CellReading[];
}

export interface FishCellResult extends CellReading {
  fishId: string | null;
}
