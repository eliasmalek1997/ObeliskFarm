import { describe, expect, it } from "vitest";
import { fishTrack, gemTrack, rankPurchases } from "../ranking";
import * as X from "./fixtures";

describe("rankPurchases (analysis player)", () => {
  const state = X.playerState();
  const all = rankPurchases(state, {});
  const fish = fishTrack(all);
  const byId = (id: string) => all.find((p) => p.id === id)!;

  it("Fishing Rod L20 is the top fish-track item (~9%, ~66 h)", () => {
    expect(fish[0]!.id).toBe("fishing_rod");
    expect(fish[0]!.toLevel).toBe(20);
    expect(fish[0]!.gainPct).toBeGreaterThan(8.5);
    expect(fish[0]!.gainPct).toBeLessThan(10);
    expect(fish[0]!.hoursToAfford).toBeCloseTo(65.6, 0);
  });

  it("Upgrade Boat L4 is valued by lookahead: not negative and in the top 10", () => {
    const boat = byId("upgrade_boat");
    expect(boat.structural).toBe(true);
    expect(boat.toLevel).toBe(4);
    expect(boat.gainPct).toBeGreaterThanOrEqual(0);
    expect(boat.gainPct).toBeGreaterThan(5); // drone base power + shiny + triple tick unlocked
    expect(fish.findIndex((p) => p.id === "upgrade_boat")).toBeLessThan(10);
    expect(boat.unlocks!.join(" ")).toContain("Drone Base Power");
  });

  it("does not drop candidates whose cost fish is not farmed now", () => {
    const drone = byId("fishing_drone"); // costs scarabshoe crab (Desert); drones are on Tundra
    expect(drone.hoursToAfford).toBeNull();
    expect(drone.gainPctPerHour).toBeNull();
    expect(drone.hoursIfFocused).toBeGreaterThan(0);
    expect(drone.note).toMatch(/Move a drone to Desert/);
    const boat = byId("upgrade_boat");
    expect(boat.hoursToAfford).toBeNull();
    expect(boat.note).toMatch(/Ocean/);
  });

  it("covers every purchase type with the documented shape", () => {
    expect(new Set(all.map((p) => p.kind))).toEqual(new Set(["upgrade", "enhancement", "skill", "fishCard"]));
    for (const p of all) {
      expect(p.toLevel).toBe(p.fromLevel + 1);
      expect(Number.isFinite(p.gainPct)).toBe(true);
      expect(p.gainPct).toBeGreaterThanOrEqual(0);
      expect(p.cost.amount).toBeGreaterThan(0);
    }
    expect(all.some((p) => p.cost.currency === "skillPoints")).toBe(true);
  });

  it("gems: hours are null without gems/h, derived with it", () => {
    const gem0 = all.find((p) => p.id === "enhance_rod_multiplier")!;
    expect(gem0.hoursToAfford).toBeNull();
    expect(gem0.gainPctPerKGem).toBeGreaterThan(0);
    const withRate = rankPurchases(state, { gemsPerHour: 500 });
    const gem = withRate.find((p) => p.id === "enhance_rod_multiplier")!;
    expect(gem.cost).toEqual({ currency: "gems", amount: 850 });
    expect(gem.hoursToAfford).toBeCloseTo(1.7, 6);
    expect(gem.gainPctPerHour).toBeCloseTo(gem.gainPct / 1.7, 9);
    // skill points are converted at 125 gems each
    const sp = withRate.find((p) => p.id === "fishing_with_friends")!;
    expect(sp.hoursToAfford).toBeCloseTo((sp.cost.amount * 125) / 500, 9);
  });

  it("tracks split currencies and sort descending", () => {
    expect(fish.every((p) => p.cost.currency === "fish")).toBe(true);
    const gems = gemTrack(all);
    expect(gems.every((p) => p.cost.currency !== "fish")).toBe(true);
    const keys = gems.map((p) => p.gainPctPerKGem ?? -1);
    expect([...keys].sort((a, b) => b - a)).toEqual(keys);
    // known gem rate keeps the same order
    const gems2 = gemTrack(rankPurchases(state, { gemsPerHour: 800 }), 800);
    expect(gems2.map((p) => p.id)).toEqual(gems.map((p) => p.id));
  });

  it("changing placement changes hours but not gains", () => {
    const onDesert = rankPurchases(X.playerState({ dronesPerDock: X.allDronesOn("desert", 43) as any, activeDockId: "desert" }), {});
    const drone = onDesert.find((p) => p.id === "fishing_drone")!;
    expect(drone.hoursToAfford).toBeGreaterThan(0);
    expect(drone.gainPct).toBeCloseTo(byId("fishing_drone").gainPct, 9);
  });
});

describe("rankPurchases (late game, T2)", () => {
  const all = rankPurchases(X.lateState(), { gemsPerHour: 300 });
  it("values the T2 boat via lookahead (non-negative)", () => {
    const t2 = all.find((p) => p.id === "upgrade_t2_boat");
    expect(t2).toBeDefined();
    expect(t2!.gainPct).toBeGreaterThanOrEqual(0);
  });
  it("is fast", () => {
    const t = performance.now();
    rankPurchases(X.lateState(), {});
    expect(performance.now() - t).toBeLessThan(500);
  });
});
