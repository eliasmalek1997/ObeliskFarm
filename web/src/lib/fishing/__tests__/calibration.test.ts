import { describe, expect, it } from "vitest";
import { computeFishingSnapshot } from "../model";
import { rankPurchases } from "../ranking";
import * as X from "./fixtures";

describe("fishing calibration", () => {
  const state = X.playerState();
  const base = computeFishingSnapshot(state, {});
  const cal = { enabled: true, rodPowerMult: 1.1, incomeMult: 1.05 };

  it("off / disabled gives identical outputs", () => {
    expect(computeFishingSnapshot(state, { calibration: null })).toEqual(base);
    expect(computeFishingSnapshot(state, { calibration: { ...cal, enabled: false } })).toEqual(base);
  });

  it("on scales rod power and income", () => {
    const s = computeFishingSnapshot(state, { calibration: cal });
    expect(s.stats.rodPowerExact).toBeCloseTo(base.stats.rodPowerExact * 1.1, 9);
    expect(s.stats.incomeMulti).toBeCloseTo(base.stats.incomeMulti * 1.05, 9);
    expect(s.stats.droneMulti).toBeCloseTo(base.stats.droneMulti, 9);
    expect(s.totalFishPerHour).toBeGreaterThanOrEqual(base.totalFishPerHour * 1.05 - 1e-6);
  });

  it("ranking still works with calibration", () => {
    const r = rankPurchases(state, { calibration: cal });
    expect(r.length).toBe(rankPurchases(state, {}).length);
    expect(r.every((p) => Number.isFinite(p.gainPct))).toBe(true);
  });
});
