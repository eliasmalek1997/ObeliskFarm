/**
 * Pure math for the "Boosts" section of the new Fishing page: when to run the Angler Drone, whether to fuel it,
 * and when to start buying the Lootbug gem buff "Fishing +12 Ticks".
 *
 * Decision metric: gems per tick-equivalent (a "tick" = one extra normal fishing tick on the current placement).
 */

// ===================================================================================================
// CONSTANTS (all copied from existing app code; correct them here once verified against the wiki)
// ===================================================================================================
/** source: modules/drone/Drone.tsx:96 Angler base interval, game-time seconds. */
export const ANGLER_BASE_INTERVAL_SEC = 1140;
/** source: modules/drone/Drone.tsx:97 ticks per Angler cycle. */
export const ANGLER_TICKS_PER_INTERVAL = 2;
/** source: modules/drone/Drone.tsx:98 suit: -40 s per level (max level 20, Drone.tsx:549). */
export const ANGLER_SUIT_SEC_PER_LEVEL = 40;
export const ANGLER_SUIT_MAX = 20;
/** source: modules/drone/Drone.tsx:100-101 fuel duration (game s) = 180 + 9 x grade, then multipliers. */
export const ANGLER_FUEL_DURATION_BASE_SEC = 180;
export const ANGLER_FUEL_DURATION_SEC_PER_GRADE = 9;
/** source: modules/drone/Drone.tsx:103-105,107 fuel buff: 1% proc per cycle, 6 + 6 x grade ticks, max 222. */
export const ANGLER_BUFF_PROC_CHANCE = 0.01;
export const ANGLER_BUFF_TICKS_BASE = 6;
export const ANGLER_BUFF_TICKS_PER_GRADE = 6;
export const ANGLER_BUFF_TICKS_MAX = 222;
/** source: modules/drone/Drone.tsx:286 gems per fuel. */
export const GEMS_PER_FUEL = 5;
/** source: modules/drone/Drone.tsx:149,187,709-731 fuel-duration multiplier parts. */
export const GASOLINE_GUZZLER_FUEL_DURATION_PCT = 20;
export const AXOLOTL_FUEL_MULT = 1.1;
export const PLATINUM_STATUE_FUEL_MULT = 1.15;
export const MISC_FUEL_MULT: Record<number, number> = { 0: 1, 1: 1.02, 2: 1.05, 3: 1.1 };
export const FUEL_WORLD3_PCT_PER_LEVEL = 0.15;
export const FUEL_RELIC_PCT_PER_LEVEL = 0.01;
/** source: lib/lootbug/constants.ts:53 "Fishing +12 Ticks": cost 35 gems, requirement "Obelisk Lvl 37". */
export const LOOTBUG_BUFF_COST = 35;
export const LOOTBUG_BUFF_TICKS = 12;
export const LOOTBUG_BUFF_OBELISK_REQ = 37;
/** source: modules/lootbug/Lootbug.tsx:536-545 ticks per purchase = 12 x lootMultiplier (expected value). */
// The Angler unlock requirement is not present in the code, so none is modelled.
// ===================================================================================================

export type FuelMultInputs = {
  fuelDurationUpgradeLevel?: number;
  fuelDurationWorld3Level?: number;
  fuelDurationRelicLevel?: number;
  gasolineGuzzler?: boolean;
  axolotlSkin?: boolean;
  platinumStatueOfAppetite?: boolean;
  miscFuelCardTier?: number;
};

export type AnglerInput = FuelMultInputs & {
  suitLevel: number;
  gradeLevel: number;
  gameSpeed: number;
  fuelSaveChanceUpgradeLevel?: number;
  upgradeFuelSaveChancePct?: number;
};

export type AnglerResult = {
  intervalSecReal: number;
  baseTicksPerHour: number;
  buffTicksPerProc: number;
  buffTicksPerHour: number;
  fuelDurationSecReal: number;
  fuelGemsPerHour: number;
  /** gems per extra tick from the fuel buff; Infinity if it gives none. */
  fuelGemsPerTick: number;
};

export function anglerStats(i: AnglerInput): AnglerResult {
  const suit = Math.max(0, Math.min(ANGLER_SUIT_MAX, i.suitLevel));
  const grade = Math.max(0, i.gradeLevel);
  const speed = i.gameSpeed > 0 ? i.gameSpeed : 1;
  const intervalGame = Math.max(1, ANGLER_BASE_INTERVAL_SEC - suit * ANGLER_SUIT_SEC_PER_LEVEL);
  const intervalSecReal = intervalGame / speed;
  const cyclesPerHour = 3600 / intervalSecReal;
  const baseTicksPerHour = ANGLER_TICKS_PER_INTERVAL * cyclesPerHour;
  const buffTicksPerProc = Math.min(ANGLER_BUFF_TICKS_MAX, ANGLER_BUFF_TICKS_BASE + ANGLER_BUFF_TICKS_PER_GRADE * grade);
  const buffTicksPerHour = ANGLER_BUFF_PROC_CHANCE * cyclesPerHour * buffTicksPerProc;
  const fuelGame = Math.round(
    (ANGLER_FUEL_DURATION_BASE_SEC + grade * ANGLER_FUEL_DURATION_SEC_PER_GRADE) *
      (1 + (i.fuelDurationUpgradeLevel ?? 0) / 100) *
      (1 + ((i.fuelDurationWorld3Level ?? 0) * FUEL_WORLD3_PCT_PER_LEVEL) / 100) *
      (i.gasolineGuzzler ? 1 + GASOLINE_GUZZLER_FUEL_DURATION_PCT / 100 : 1) *
      (i.axolotlSkin ? AXOLOTL_FUEL_MULT : 1) *
      (i.platinumStatueOfAppetite ? PLATINUM_STATUE_FUEL_MULT : 1) *
      (MISC_FUEL_MULT[i.miscFuelCardTier ?? 0] ?? 1) *
      (1 + ((i.fuelDurationRelicLevel ?? 0) * FUEL_RELIC_PCT_PER_LEVEL) / 100),
  );
  const fuelDurationSecReal = fuelGame / speed;
  const coal = (i.fuelSaveChanceUpgradeLevel ?? 0) / 100;
  const upg = (i.upgradeFuelSaveChancePct ?? 0) / 100;
  const save = 1 - (1 - coal) * (1 - upg);
  const fuelGemsPerHour = fuelDurationSecReal > 0 ? (3600 / fuelDurationSecReal) * (1 - save) * GEMS_PER_FUEL : 0;
  return {
    intervalSecReal,
    baseTicksPerHour,
    buffTicksPerProc,
    buffTicksPerHour,
    fuelDurationSecReal,
    fuelGemsPerHour,
    fuelGemsPerTick: buffTicksPerHour > 0 ? fuelGemsPerHour / buffTicksPerHour : Infinity,
  };
}

export function lootbugBuff(gemCostReduction: number, lootMultiplier: number) {
  const effectiveCost = Math.max(1, LOOTBUG_BUFF_COST - Math.max(0, gemCostReduction));
  const ticksPerPurchase = LOOTBUG_BUFF_TICKS * Math.max(0, lootMultiplier);
  return { effectiveCost, ticksPerPurchase, gemsPerTick: ticksPerPurchase > 0 ? effectiveCost / ticksPerPurchase : Infinity };
}

/** Normal fishing ticks per hour (3600 / effective tick seconds). */
export function normalTicksPerHour(effectiveTickSeconds: number): number {
  return effectiveTickSeconds > 0 ? 3600 / effectiveTickSeconds : 0;
}

/** Fish per normal tick on the current placement (extra ticks pay out on fished docks like sushi). */
export function fishPerTick(totalFishPerHour: number, ticksPerHour: number): number {
  return ticksPerHour > 0 ? totalFishPerHour / ticksPerHour : 0;
}

/** Gems per tick-equivalent of an enhancement: cost / (gainPct/100 x ticks/h x horizon hours). */
export function enhancementGemsPerTick(costGems: number, gainPct: number, ticksPerHour: number, horizonHours: number): number {
  const eq = (gainPct / 100) * ticksPerHour * horizonHours;
  return eq > 0 && costGems > 0 ? costGems / eq : Infinity;
}

export type Verdict = { go: boolean; text: string };

export function fuelAdvice(fuelGemsPerTick: number, best: { gemsPerTick: number; name: string } | null): Verdict {
  if (!Number.isFinite(fuelGemsPerTick)) return { go: false, text: "Fuel gives no extra ticks here." };
  if (!best || !Number.isFinite(best.gemsPerTick)) return { go: true, text: "Fuel it: no gem enhancements are left to spend on." };
  if (fuelGemsPerTick < best.gemsPerTick) return { go: true, text: `Fuel it: ${fuelGemsPerTick.toFixed(1)} gems/tick beats ${best.gemsPerTick.toFixed(1)} for ${best.name}.` };
  return { go: false, text: `Don't fuel yet: ${fuelGemsPerTick.toFixed(1)} gems/tick vs ${best.gemsPerTick.toFixed(1)} for ${best.name}.` };
}

export function lootbugAdvice(gemsPerTick: number, best: { gemsPerTick: number; name: string } | null): Verdict {
  if (!best || !Number.isFinite(best.gemsPerTick)) return { go: true, text: "Buy it: no gem enhancements are left to spend on." };
  if (gemsPerTick < best.gemsPerTick) return { go: true, text: `Buy it now: ${gemsPerTick.toFixed(2)} gems/tick beats ${best.gemsPerTick.toFixed(2)} for ${best.name}.` };
  return {
    go: false,
    text: `Start buying once your gem upgrades cost more than ${gemsPerTick.toFixed(2)} gems per tick (you're at ${best.gemsPerTick.toFixed(2)} now with ${best.name}).`,
  };
}

/** One purchase finishes the top fish-track item when its fish >= what is still missing. */
export function oneBuyFinishes(ticksPerPurchase: number, fishPerTickForItem: number, remaining: number): boolean {
  return remaining > 0 && ticksPerPurchase * fishPerTickForItem >= remaining;
}
