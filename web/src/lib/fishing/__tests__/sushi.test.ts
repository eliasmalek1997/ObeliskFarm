import { describe, expect, it } from "vitest";
import { computeFishingSnapshot } from "../model";
import { coverage, sushiAdvice, sushiYield, ticksPerSushi } from "../sushi";
import * as X from "./fixtures";

describe("sushi math", () => {
  it("ticks per sushi = 90 + card + workshop", () => {
    expect(ticksPerSushi(0)).toBe(90);
    expect(ticksPerSushi(3)).toBe(110);
    expect(ticksPerSushi(1, 7)).toBe(102);
  });
  it("matches classic ticks * fish/h / rawTicks/h", () => {
    const snap = computeFishingSnapshot(X.playerState(), {});
    const dock = snap.docks.find((d) => d.hasRod)!;
    const y = sushiYield(snap.docks, 90);
    const rawTicksPerHour = dock.fillsPerHour * dock.ticksNeeded;
    expect(y.totalFish).toBeCloseTo((90 * snap.totalFishPerHour) / rawTicksPerHour, 6);
    expect(sushiYield(snap.docks, 180).totalFish).toBeCloseTo(2 * y.totalFish, 6);
    expect(sushiYield(snap.docks, 0).totalFish).toBe(0);
  });
  it("coverage and advice", () => {
    expect(coverage(170, 500)).toBeCloseTo(0.34);
    expect(coverage(1, 0)).toBe(0);
    expect(sushiAdvice({ hasTarget: true, currentFarmsTarget: true, currentTargetFish: 5, bestTargetFish: 5 }).text).toMatch(/now/);
    expect(sushiAdvice({ hasTarget: true, currentFarmsTarget: false, currentTargetFish: 0, bestTargetFish: 5 }).text).toMatch(/Move drones/);
  });
});
