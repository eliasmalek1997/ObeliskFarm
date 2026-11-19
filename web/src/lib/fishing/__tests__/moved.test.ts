import { describe, expect, it } from "vitest";
import { computeFishingStatsFromLevels } from "../computeStats";
import { formatEnhanceNextEffect, formatUpgradeNextEffect } from "../effectText";
import {
  computeTotalFishPerHour,
  computeTotalFishPerHourFromStats,
  getGreedyDockAssignment,
  tinyNoticeMarginalPct,
  tokenMultiplierMarginalPct,
} from "../model";
import { BEFORE_REFACTOR as B } from "./beforeRefactor";
import * as X from "./fixtures";

/**
 * The expected values in beforeRefactor.ts were captured from the ORIGINAL Fishing.tsx implementation before these
 * functions moved into lib/fishing/model.ts. Same inputs must give bit-identical outputs.
 */
describe("moved functions are unchanged", () => {
  const el = { uptimeFraction: 0.3 };
  const el0 = { uptimeFraction: 0 };
  const cases: [string, any, any, any, string, any, number][] = [
    ["player0", X.PLAYER_UPGRADES, X.PLAYER_ENHANCES, X.allDronesOn("ocean", 43), "ocean", X.PLAYER_OPTS, 0],
    ["player1", X.PLAYER_UPGRADES, X.PLAYER_ENHANCES, X.allDronesOn("lake", 43), "lake", { ...X.PLAYER_OPTS, fishingRodCardTier: 3 }, 400],
    ["late", X.LATE_UPGRADES, X.LATE_ENHANCES, X.allDronesOn("galaxy", 120), "galaxy", X.LATE_OPTS, 900],
    ["default", {}, {}, X.allDronesOn("lake", 5), "lake", {}, 0],
  ];
  for (const [n, u, e, d, a, o, x] of cases) {
    it(`${n}: totals / greedy / fromStats`, () => {
      expect(computeTotalFishPerHour(u, e, d, a as any, el0, o, x)).toBe(B[`${n}.total.el0`]);
      expect(computeTotalFishPerHour(u, e, d, a as any, el, o, x)).toBe(B[`${n}.total.el`]);
      const g = getGreedyDockAssignment(u, e, o, el, x);
      expect(g).toEqual(B[`${n}.greedy`]);
      expect(computeTotalFishPerHour(u, e, g.dronesPerDock, g.activeDockId, el, o, x)).toBe(B[`${n}.greedyTotal`]);
      const st = computeFishingStatsFromLevels(u, e, o);
      expect(computeTotalFishPerHourFromStats(st, d, a as any, el, undefined, x)).toBe(B[`${n}.fromStats`]);
      expect(computeTotalFishPerHourFromStats(st, d, a as any, el, 300, x, { lake: 4, ocean: 12 })).toBe(B[`${n}.fromStats.rod`]);
    });
    it(`${n}: next-effect strings`, () => {
      const st = computeFishingStatsFromLevels(u, e, o);
      expect(
        Object.keys(u).map((id) =>
          formatUpgradeNextEffect(id as any, st, computeFishingStatsFromLevels({ ...u, [id]: (u[id] ?? 0) + 1 }, e, o), u),
        ),
      ).toEqual(B[`${n}.fmtU`]);
      expect(
        Object.keys(e).map((id) =>
          formatEnhanceNextEffect(id as any, st, computeFishingStatsFromLevels(u, { ...e, [id]: (e[id] ?? 0) + 1 }, o), e),
        ),
      ).toEqual(B[`${n}.fmtE`]);
    });
  }
  it("indirect marginal helpers", () => {
    expect([0, 3, 20].map(tokenMultiplierMarginalPct)).toEqual(B.token);
    expect([0, 3, 20].map(tinyNoticeMarginalPct)).toEqual(B.tiny);
  });
});
