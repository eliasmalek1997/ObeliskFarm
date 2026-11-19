import fs from "node:fs";
import zlib from "node:zlib";
import type { RGBAImage } from "../types";

/** Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced) for the test fixture. */
export function decodePng(buf: Buffer): RGBAImage {
  let pos = 8;
  let w = 0;
  let h = 0;
  let ct = 2;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      ct = body[9];
    } else if (type === "IDAT") idat.push(body);
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8ClampedArray(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let add = 0;
      if (f === 1) add = a;
      else if (f === 2) add = b;
      else if (f === 3) add = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      out[o] = line[x * bpp];
      out[o + 1] = line[x * bpp + 1];
      out[o + 2] = line[x * bpp + 2];
      out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    prev = line;
  }
  return { width: w, height: h, data: out };
}

export function loadFixture(): RGBAImage {
  return decodePng(fs.readFileSync(new URL("./fixtures/aquarium_grid.png", import.meta.url)));
}

export function rescale(img: RGBAImage, k: number, mode: "nearest" | "bilinear"): RGBAImage {
  const w = Math.round(img.width * k);
  const h = Math.round(img.height * k);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5) / k - 0.5;
      const sy = (y + 0.5) / k - 0.5;
      for (let c = 0; c < 4; c++) {
        let v: number;
        if (mode === "nearest") {
          const ix = Math.min(img.width - 1, Math.max(0, Math.round(sx)));
          const iy = Math.min(img.height - 1, Math.max(0, Math.round(sy)));
          v = img.data[(iy * img.width + ix) * 4 + c];
        } else {
          const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(sx)));
          const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(sy)));
          const x1 = Math.min(img.width - 1, x0 + 1);
          const y1 = Math.min(img.height - 1, y0 + 1);
          const fx = Math.max(0, Math.min(1, sx - x0));
          const fy = Math.max(0, Math.min(1, sy - y0));
          const g = (xx: number, yy: number) => img.data[(yy * img.width + xx) * 4 + c];
          v = (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy;
        }
        out[(y * w + x) * 4 + c] = v;
      }
    }
  }
  return { width: w, height: h, data: out };
}

export function crop(img: RGBAImage, x0: number, y0: number, x1: number, y1: number): RGBAImage {
  const w = x1 - x0;
  const h = y1 - y0;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) out[(y * w + x) * 4 + c] = img.data[((y0 + y) * img.width + x0 + x) * 4 + c];
  return { width: w, height: h, data: out };
}

export const EXPECTED = [10009, 3486, 1289, 96, 17721, 9589, 427, 7, 565, 350, 407, 535, 0, 0, 0, 0];
