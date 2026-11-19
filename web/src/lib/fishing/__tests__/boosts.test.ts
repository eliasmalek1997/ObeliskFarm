import { describe, expect, it } from "vitest";
import { anglerStats, enhancementGemsPerTick, fuelAdvice, lootbugAdvice, lootbugBuff, normalTicksPerHour, oneBuyFinishes } from "../boosts";

describe("boosts math", () => {
  it("player example angler", () => {
    const a = anglerStats({ suitLevel: 10, gradeLevel: 0, gameSpeed: 3.61 });
    expect(a.intervalSecReal).toBeCloseTo(205, 0);
    expect(a.baseTicksPerHour).toBeCloseTo(35.1, 1);
    expect(a.buffTicksPerProc).toBe(6);
  });
  it("fuel buff ticks, duration and gems", () => {
    const a = anglerStats({ suitLevel: 0, gradeLevel: 10, gameSpeed: 1, fuelSaveChanceUpgradeLevel: 10, upgradeFuelSaveChancePct: 0 });
    expect(a.buffTicksPerProc).toBe(66);
    expect(a.fuelDurationSecReal).toBe(270);
    expect(a.fuelGemsPerHour).toBeCloseTo((3600 / 270) * 0.9 * 5, 6);
    expect(anglerStats({ suitLevel: 0, gradeLevel: 100, gameSpeed: 1 }).buffTicksPerProc).toBe(222);
  });
  it("lootbug example", () => {
    const l = lootbugBuff(2, 1.9166);
    expect(l.effectiveCost).toBe(33);
    expect(l.ticksPerPurchase).toBeCloseTo(23, 0);
  });
  it("normal ticks and enhancement metric", () => {
    expect(normalTicksPerHour(53.5)).toBeCloseTo(67.3, 1);
    expect(enhancementGemsPerTick(1000, 1, 100, 100)).toBeCloseTo(10);
    expect(enhancementGemsPerTick(1000, 0, 100, 100)).toBe(Infinity);
  });
  it("advice", () => {
    expect(fuelAdvice(5, { gemsPerTick: 10, name: "X" }).go).toBe(true);
    expect(fuelAdvice(15, { gemsPerTick: 10, name: "X" }).go).toBe(false);
    expect(fuelAdvice(15, null).go).toBe(true);
    expect(lootbugAdvice(1, { gemsPerTick: 2, name: "X" }).go).toBe(true);
    expect(lootbugAdvice(3, { gemsPerTick: 2, name: "X" }).text).toMatch(/Start buying/);
    expect(oneBuyFinishes(23, 10, 200)).toBe(true);
    expect(oneBuyFinishes(23, 10, 300)).toBe(false);
  });
});
