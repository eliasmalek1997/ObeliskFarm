import fs from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ALL_FISH } from "../constants";
import { readAquariumScreenshot } from "../screenshot";
import { readScreenshotForFish } from "../screenshot";
import { crop, EXPECTED, loadFixture, rescale } from "../screenshot/__tests__/helpers";
import type { RGBAImage } from "../screenshot";

const REF = "/root/.claude/uploads/37e9a6c1-5dff-5a76-8d3c-3cc1887c4abf/75f6ab82-image.jpg";

function check(img: RGBAImage) {
  const r = readAquariumScreenshot(img);
  expect(r).not.toBeNull();
  const cells = r!.cells;
  expect(cells.slice(0, 16).map((c) => c.value)).toEqual(EXPECTED);
  for (const c of cells.slice(16)) expect(c.kind).toBe("undiscovered");
  return r!;
}

describe("aquarium screenshot reader (fixture)", () => {
  const img = loadFixture();
  it("reads all counts", () => {
    const r = check(img);
    expect(r.grid.topCut).toBe(false);
    expect(r.cells.length).toBe(32);
  });
  it("assigns fish ids", () => {
    const r = readScreenshotForFish(img, 0)!;
    expect(r.cells[0].fishId).toBe(ALL_FISH[0].id);
    expect(r.cells[5].fishId).toBe(ALL_FISH[5].id);
  });
  for (const mode of ["nearest", "bilinear"] as const) {
    for (const k of [0.8, 1.28, 1.5]) {
      it(`rescaled x${k} (${mode})`, () => {
        check(rescale(img, k, mode));
      });
    }
  }
  for (const mode of ["nearest", "bilinear"] as const) {
    it(`0.6x (${mode}) is best effort: any misread cell must be low confidence`, () => {
      const r = readAquariumScreenshot(rescale(img, 0.6, mode))!;
      r.cells.slice(0, 16).forEach((c, i) => {
        if (c.value !== EXPECTED[i]) expect(c.confidence).toBeLessThan(0.3);
      });
    });
  }
  it("only the 4 discovered rows (all cells with sprites)", () => {
    const r = readAquariumScreenshot(crop(img, 0, 0, img.width, 790))!;
    expect(r.cells.slice(0, 16).map((c) => c.value)).toEqual(EXPECTED);
  });
  it("detects a scrolled grid (cut row on top)", () => {
    const r = readAquariumScreenshot(crop(img, 0, 230, img.width, img.height))!;
    expect(r.grid.topCut).toBe(true);
    expect(r.cells.slice(0, 4).map((c) => c.value)).toEqual(EXPECTED.slice(8, 12));
  });
  it("returns null without a grid", () => {
    const blank = { width: 200, height: 200, data: new Uint8ClampedArray(200 * 200 * 4).fill(40) };
    expect(readAquariumScreenshot(blank)).toBeNull();
  });
});

describe.skipIf(!fs.existsSync(REF))("aquarium screenshot reader (full reference JPEG)", () => {
  const require = createRequire(import.meta.url);
  const jpeg = require("jpeg-js");
  const img = jpeg.decode(fs.readFileSync(REF), { useTArray: true }) as RGBAImage;
  it("reads exactly", () => {
    check(img);
  });
  for (const mode of ["nearest", "bilinear"] as const)
    for (const k of [0.8, 1.28])
      it(`x${k} ${mode}`, () => {
        check(rescale(img, k, mode));
      });
});
