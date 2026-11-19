import { describe, expect, it } from "vitest";
import {
  computeFishingSnapshot,
  computeTotalFishPerHour,
  buildTotalFishOptions,
  suggestDronePlacement,
} from "../model";
import { getDefaultFishingState } from "../state";
import * as X from "./fixtures";

describe("computeFishingSnapshot (analysis player, Obelisk 49, boat 3)", () => {
  const state = X.playerState();
  const snap = computeFishingSnapshot(state, {});

  it("matches the in-game stats", () => {
    expect(snap.stats.rodPowerExact).toBeCloseTo(273.504, 3);
    expect(snap.stats.droneCap).toBe(43);
    expect(snap.stats.droneMulti).toBeCloseTo(1.562, 3);
    expect(snap.stats.incomeMulti).toBeCloseTo(1.8034, 3);
    expect(snap.stats.tickSeconds).toBeCloseTo(53.5, 6);
    expect(snap.stats.doubleTickPct).toBeCloseTo(4.5, 6);
    expect(snap.stats.boatLevel).toBe(3);
    expect(snap.stats.rodPower).toBe(274); // rounded once
  });

  it("locks docks above the boat level", () => {
    expect(snap.docks.map((d) => d.unlocked)).toEqual([true, true, true, true, false, false, false, false, false, false, false]);
    expect(snap.docks.find((d) => d.dockId === "nuclear")!.limitedBy).toBe("locked");
    expect(snap.docks.find((d) => d.dockId === "nuclear")!.fishPerHour).toBe(0);
  });

  it("rod + 43 drones on Tundra: all fish rates live on Tundra", () => {
    const tundra = snap.docks.find((d) => d.dockId === "tundra")!;
    expect(tundra.hasRod).toBe(true);
    expect(tundra.dronesAssigned).toBe(43);
    expect(tundra.powerOnDock).toBeCloseTo(274 + 43 * snap.stats.dronePower, 6);
    expect(snap.dronesAssigned).toBe(43);
    expect(snap.totalFishPerHour).toBeCloseTo(tundra.fishPerHour, 9);
    expect(snap.fishRates["frostshell_crab"] ?? snap.fishRates[tundra.fish[1]!.fishId]).toBeGreaterThan(0);
    expect(snap.docks.find((d) => d.dockId === "lake")!.fishPerHour).toBe(0);
  });

  it("equals computeTotalFishPerHour (the classic formula) for the same assignment", () => {
    const ctx = { elixir3xUptimeFraction: 0.25, extraTicksPerHour: 350 };
    const s = computeFishingSnapshot(state, ctx);
    const classic = computeTotalFishPerHour(
      state.upgradeLevels,
      state.enhanceLevels,
      state.dronesPerDock,
      state.activeDockId,
      { uptimeFraction: 0.25 },
      buildTotalFishOptions(state),
      350,
    );
    expect(s.totalFishPerHour).toBeCloseTo(classic, 9);
    expect(Object.values(s.fishRates).reduce((a, b) => a + b, 0)).toBeCloseTo(classic, 9);
  });

  it("all on Ocean reproduces the analysis (5.9 fish/h)", () => {
    const s = computeFishingSnapshot(
      X.playerState({ dronesPerDock: X.allDronesOn("ocean", 43) as any, activeDockId: "ocean" }),
    );
    expect(s.totalFishPerHour).toBeCloseTo(5.9256, 3);
    expect(s.docks.find((d) => d.dockId === "ocean")!.limitedBy).toBe("power");
  });

  it("default state is sane", () => {
    const s = computeFishingSnapshot(getDefaultFishingState());
    expect(s.totalFishPerHour).toBeGreaterThan(0);
    expect(s.docks.filter((d) => d.unlocked).length).toBe(1);
  });
});

describe("suggestDronePlacement", () => {
  const state = X.playerState();
  it("top-dock puts everything on the highest unlocked dock (classic greedy)", () => {
    const p = suggestDronePlacement(state, {}, { kind: "top-dock" });
    expect(p.activeDockId).toBe("ocean");
    expect(p.dronesPerDock.ocean).toBe(43);
  });
  it("farm-fish moves everything to the fish's dock", () => {
    const p = suggestDronePlacement(state, {}, { kind: "farm-fish", fishId: "frostshell_crab" });
    expect(p.activeDockId).toBe("tundra");
    expect(p.targetFishPerHour).toBeGreaterThan(0);
  });
  it("max-fish is at least as good as any concentrated placement and uses all drones", () => {
    const best = suggestDronePlacement(state, {}, { kind: "max-fish" });
    const top = suggestDronePlacement(state, {}, { kind: "top-dock" });
    expect(best.totalFishPerHour).toBeGreaterThanOrEqual(top.totalFishPerHour);
    expect(Object.values(best.dronesPerDock).reduce((a, b) => a + b, 0)).toBe(43);
    // consistent with the snapshot for that assignment
    const snap = computeFishingSnapshot({ ...state, dronesPerDock: best.dronesPerDock, activeDockId: best.activeDockId });
    expect(snap.totalFishPerHour).toBeCloseTo(best.totalFishPerHour, 9);
  });
});
