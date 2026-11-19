/**
 * Pure Lootbug rates (moved out of modules/lootbug/Lootbug.tsx; formulas unchanged, see
 * lib/gems/__tests__/moved.test.ts which pins them to numbers captured from the original component).
 */
import { FREE_BUFFS, GEM_BUFFS, getDurationMinutes, getWeight } from "./constants";

export const LOOTBUG_BASE_SPAWN_MIN = 20;
export const DEFAULT_ACTIVE_GEM_BUFFS = ["10x Bomb Recharge"];

export type LootbugState = {
  spawnRateMultiplier: number;
  tripleChancePct: number;
  goldenChancePct: number;
  gemCostReduction: number;
  lootMultiplier: number;
  activeGemBuffs: string[];
  /** Banked Lootbugs cap (max capacity). */
  bankCap: number;
};

export const DEFAULT_LOOTBUG_STATE: LootbugState = {
  spawnRateMultiplier: 1,
  tripleChancePct: 0,
  goldenChancePct: 0,
  gemCostReduction: 0,
  lootMultiplier: 1,
  activeGemBuffs: DEFAULT_ACTIVE_GEM_BUFFS,
  bankCap: 10,
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export type LootbugRates = {
  spawnsPerHour: number;
  expectedLootbugsPerSpawn: number;
  lootbugsPerHour: number;
  /** "+2 Gems" free buff, x loot multiplier. */
  gemsPerHour: number;
  /** 10x Bomb Recharge real minutes/h from ALL gem-buff rolls (classic: counted whether or not the buff is bought). */
  bombRecharge10xMinPerHour: number;
  itemChestsPerHourFree: number;
  /** "+3 Item Chests" only when bought (classic). */
  itemChestsPerHourGem: number;
  relicChestsPerHourFree: number;
  relicChestsPerHourGem: number;
  /** Gem cost of every bought gem buff, per hour (golden = free). */
  totalGemCostPerHour: number;
  /** "+10 Cherry Charges" free buff: charges per hour (x loot multiplier). */
  cherryFreeChargesPerHour: number;
  /** "+100 Cherry Charges" gem buff: charges/h counting it when bought or via golden procs only. */
  cherry100ChargesPerHour: number;
  /** Rolls per hour of a gem buff (all rolls, before purchase / golden gating). */
  gemBuffRollsPerHour: (name: string) => number;
  totalGemWeightAll: number;
  totalFreeWeight: number;
};

/**
 * @param gameSpeed effective game speed for time systems (getEffectiveGameSpeedMultiplierForTime)
 * @param bombBearSpawnRateMult Bomb Bear drone multiplier (1 when off)
 */
export function lootbugRates(state: LootbugState, gameSpeed: number, bombBearSpawnRateMult: number): LootbugRates {
  const spawnRateMult = clamp(state.spawnRateMultiplier, 0.1, 20);
  const effectiveSpawnRateMult = spawnRateMult * bombBearSpawnRateMult;
  const triplePct = clamp(state.tripleChancePct, 0, 100) / 100;
  const effectiveSpawnMinGame = effectiveSpawnRateMult > 0 ? LOOTBUG_BASE_SPAWN_MIN / effectiveSpawnRateMult : 0;
  const effectiveSpawnMinReal = gameSpeed > 0 && effectiveSpawnMinGame > 0 ? effectiveSpawnMinGame / gameSpeed : 0;
  const spawnsPerHour = effectiveSpawnMinReal > 0 ? 60 / effectiveSpawnMinReal : 0;
  const expectedLootbugsPerSpawn = 1 + 2 * triplePct;
  const lootbugsPerHour = spawnsPerHour * expectedLootbugsPerSpawn;

  const totalFreeWeight = FREE_BUFFS.reduce((s, b) => s + getWeight(b), 0);
  const activeGemBuffs = Array.isArray(state.activeGemBuffs) ? state.activeGemBuffs : DEFAULT_ACTIVE_GEM_BUFFS;
  const buyGemBuffsSet = new Set(activeGemBuffs);
  const totalGemWeightAll = GEM_BUFFS.reduce((s, b) => s + getWeight(b), 0);
  const lootMultiplier = clamp(state.lootMultiplier, 0.1, 5);
  const goldenPct = clamp(state.goldenChancePct, 0, 100) / 100;

  const plus2Gems = FREE_BUFFS.find((b) => b.name === "+2 Gems");
  let gemsPerHour = 0;
  if (plus2Gems && totalFreeWeight > 0) {
    const perHour = (lootbugsPerHour * getWeight(plus2Gems)) / totalFreeWeight;
    gemsPerHour = perHour * 2 * lootMultiplier;
  }

  let bombRecharge10xMinPerHour = 0;
  if (gameSpeed > 0) {
    const buff = GEM_BUFFS.find((b) => b.name === "10x Bomb Recharge");
    if (buff && totalGemWeightAll > 0) {
      const perHour = (lootbugsPerHour * getWeight(buff)) / totalGemWeightAll;
      const durMin = getDurationMinutes(buff.duration) ?? 0;
      bombRecharge10xMinPerHour = (perHour * durMin * lootMultiplier) / gameSpeed;
    }
  }

  const gemProcs = (name: string): number => {
    const buff = GEM_BUFFS.find((b) => b.name === name);
    if (!buff || totalGemWeightAll <= 0) return 0;
    return (lootbugsPerHour * getWeight(buff)) / totalGemWeightAll;
  };

  const itemChestsPerHourFree = (() => {
    const buff = FREE_BUFFS.find((b) => b.name === "+1 Item Chest");
    if (!buff || totalFreeWeight <= 0) return 0;
    const procsPerHour = (lootbugsPerHour * getWeight(buff)) / totalFreeWeight;
    return procsPerHour * lootMultiplier;
  })();
  const itemChestsPerHourGem = (() => {
    if (!buyGemBuffsSet.has("+3 Item Chests")) return 0;
    const buff = GEM_BUFFS.find((b) => b.name === "+3 Item Chests");
    if (!buff || totalGemWeightAll <= 0) return 0;
    const perHour = (lootbugsPerHour * getWeight(buff)) / totalGemWeightAll;
    return perHour * 3 * lootMultiplier;
  })();
  const relicChestsPerHourFree = (() => {
    const buff = FREE_BUFFS.find((b) => b.name === "+1 Relic Chest");
    if (!buff || totalFreeWeight <= 0) return 0;
    const procsPerHour = (lootbugsPerHour * getWeight(buff)) / totalFreeWeight;
    return procsPerHour * lootMultiplier;
  })();
  const relicChestsPerHourGem = (() => {
    if (!buyGemBuffsSet.has("+1 Relic Chest")) return 0;
    const buff = GEM_BUFFS.find((b) => b.name === "+1 Relic Chest");
    if (!buff || totalGemWeightAll <= 0) return 0;
    const perHour = (lootbugsPerHour * getWeight(buff)) / totalGemWeightAll;
    return perHour * lootMultiplier;
  })();

  let totalGemCostPerHour = 0;
  if (totalGemWeightAll > 0) {
    let sum = 0;
    for (const buff of GEM_BUFFS) {
      if (!buyGemBuffsSet.has(buff.name)) continue;
      const perHour = (lootbugsPerHour * getWeight(buff)) / totalGemWeightAll;
      const actualCost = Math.max(0, buff.cost - state.gemCostReduction);
      sum += perHour * actualCost * (1 - goldenPct);
    }
    totalGemCostPerHour = sum;
  }

  const cherryFreeChargesPerHour = (() => {
    const buff = FREE_BUFFS.find((b) => b.name === "+10 Cherry Charges");
    if (!buff || totalFreeWeight <= 0 || lootbugsPerHour <= 0) return 0;
    const procsPerHour = lootbugsPerHour * (getWeight(buff) / totalFreeWeight);
    return procsPerHour * 10 * lootMultiplier;
  })();
  const cherry100ChargesPerHour = (() => {
    const buff = GEM_BUFFS.find((b) => b.name === "+100 Cherry Charges");
    if (!buff || totalGemWeightAll <= 0 || lootbugsPerHour <= 0) return 0;
    const perHourProcs = (lootbugsPerHour * getWeight(buff)) / totalGemWeightAll;
    const effectiveRate = buyGemBuffsSet.has("+100 Cherry Charges") ? 1 : goldenPct;
    return perHourProcs * effectiveRate * 100 * lootMultiplier;
  })();

  return {
    spawnsPerHour,
    expectedLootbugsPerSpawn,
    lootbugsPerHour,
    gemsPerHour,
    bombRecharge10xMinPerHour,
    itemChestsPerHourFree,
    itemChestsPerHourGem,
    relicChestsPerHourFree,
    relicChestsPerHourGem,
    totalGemCostPerHour,
    cherryFreeChargesPerHour,
    cherry100ChargesPerHour,
    gemBuffRollsPerHour: gemProcs,
    totalGemWeightAll,
    totalFreeWeight,
  };
}
