/**
 * Pure Fishing model (no React, no storage). Everything the Fishing UIs and the purchase ranking need:
 * fish/h formulas, dock assignment helpers and {@link computeFishingSnapshot}.
 *
 * The first half of this file (constants, `computeTotalFishPerHour`, `getGreedyDockAssignment`,
 * `computeTotalFishPerHourFromStats`, ...) was moved verbatim out of `modules/fishing/Fishing.tsx`
 * so the classic page keeps rendering identical numbers. The second half is the new snapshot API.
 */

import {
  AQUARIUM,
  DOCKS,
  catchChancePercent,
  computeFishingStatsFromLevels,
  effectiveFishingTickSec,
  expectedCatchesPerRoll,
  getEffectiveTicksNeeded,
  getFishById,
  type ComputedFishingStats,
  type DockId,
  type FishingUpgradeId,
  type EnhanceId,
  type FishingSkillId,
  type FishDef,
  type SkillTreeOptions,
} from "./index";
import type { FishCardTier, FishingState } from "./state";
import type { FishingExternalData } from "./external";

// ———————————————————— moved from Fishing.tsx (unchanged) ————————————————————

/** Sushi: base 90 ticks. Sushi Misc card: Card +5, Gilded +10, Poly +20. */
export const SUSHI_BASE_TICKS = 90;
export const SUSHI_CARD_TICKS: Record<FishCardTier, number> = { 0: 0, 1: 5, 2: 10, 3: 20 };
/** Fishing Rod card: Fishing Rod Power. Card 1.02×, Gilded 1.05×, Poly 1.10×. */
export const FISHING_ROD_CARD_MULT: Record<FishCardTier, number> = { 0: 1, 1: 1.02, 2: 1.05, 3: 1.1 };

/** 1 skill point = 125 gems (for cost efficiency: marginal % per gem). */
export const GEMS_PER_SKILL_POINT = 125;

/** Notice Fish Req -10% per level (additive: 3 levels = -30% → 0.70x). First level: 1→0.9 = 1/0.9 − 1 ≈ +11.1% effective gains when notice farming. */
export const FRIENDSHIP_ENDED_NOTICE_MARGINAL_PCT = (1 / 0.9 - 1) * 100;
/** Token Multiplier: +0.05 per level (1.05, 1.10, …). Marginal gain = relative to current mult, e.g. 1.05→1.10 = 0.05/1.05 ≈ 4.76%. */
export function tokenMultiplierMarginalPct(currentLevel: number): number {
  const currentMult = 1 + 0.05 * currentLevel;
  return (0.05 / currentMult) * 100;
}
/** Tiny Notice: +0.5% chance per level; Tiny = 10× value. Expected mult = 1 + chance×9. Marginal = relative to current mult. */
export function tinyNoticeMarginalPct(currentLevel: number): number {
  const currentMult = 1 + currentLevel * 0.005 * 9;
  return (0.005 * 9 / currentMult) * 100;
}

/** Options for skill tree when computing total fish per hour (for marginal %). Includes store bundles and other SkillTreeOptions used by computeFishingStatsFromLevels. */
export type TotalFishOptions = {
  skillTreeLevels?: Partial<Record<FishingSkillId, number>>;
  fishCardTier?: Partial<Record<string, number>>;
  valuePackPotencyPoly?: boolean;
  legendaryFishFound?: number;
  /** Abyss Legendary (Cthulhu) caught: Abyss dock tick req -9. */
  abyssLegendaryCaught?: boolean;
  /** Fishing Rod card tier (0–3) for rod power mult 1 / 1.02 / 1.05 / 1.10. */
  fishingRodCardTier?: FishCardTier;
  /** Mr Nibbles Card: 0 = none, 1 = +1% Tiny Notice, 2 = +2%, 3 = +4%. */
  mrNibblesCardTier?: FishCardTier;
  relic5xPoints?: number;
  mrNibblesLevel?: number;
  mrNibblesQuestUnlocked?: boolean;
  mrNibblesSkin?: boolean;
  mrNibblesQuestRank?: number;
  poseidonIdolLevel?: number;
  tethysIdolLevel?: number;
  astraeusIdolLevel?: number;
  droneBasePowerWorld3Upgrade?: number;
  fishingDroneBasePowerWorld3?: number;
  legendaryHaulerBundle?: boolean;
  fishersBundle?: boolean;
  anglerBundle?: boolean;
  halfWayBundle?: boolean;
  divineChallengeCoinLevel?: number;
  infernalMrNibblesPct?: number;
  infernalMrNibblesLevel?: number;
  infernalAnglerDronePct?: number;
  infernalAnglerDroneLevel?: number;
  constructStatue?: "none" | "gilded" | "platinized";
  cetusLevel?: number;
  superStarsLevel?: number;
  blackHoleBonus?: boolean;
};

/**
 * Total fish per hour for given levels and dock assignment (same formula as Fishing gains list).
 * Used to compute marginal % gain from +1 level by comparing total with hypothetical levels.
 * When extraTicksPerHour is passed (Angler + Lootbug + Gift Sushi), fills use base + extra so the total matches the displayed gains list and marginal % is correct.
 */
export function computeTotalFishPerHour(
  upgradeLevels: Partial<Record<FishingUpgradeId, number>>,
  enhanceLevels: Partial<Record<EnhanceId, number>>,
  dronesPerDock: Record<DockId, number>,
  activeDockId: DockId,
  elixir3xFishingExternal: { uptimeFraction: number },
  skillOptions?: TotalFishOptions,
  extraTicksPerHour: number = 0,
): number {
  const stats = computeFishingStatsFromLevels(upgradeLevels, enhanceLevels, skillOptions);
  const s = stats.shiny_fish_chance_pct / 100;
  const s2 = stats.super_shiny_chance_pct / 100;
  const expectedShinyMulti =
    (1 - s) * 1 +
    s * (1 - s2) * stats.shiny_multiplier +
    s * s2 * stats.shiny_multiplier * stats.super_shiny_multiplier;
  const tickDurationSec = Math.max(1, 60 + stats.fishing_tick_reduction);
  const effectiveTickSec = effectiveFishingTickSec(tickDurationSec, elixir3xFishingExternal.uptimeFraction);
  const doublePct = stats.double_tick_chance_pct / 100;
  const triplePct = stats.triple_tick_chance_pct / 100;
  const fivePct = stats.five_tick_chance_pct / 100;
  const expectedRollsPerFill = (1 + doublePct) * (1 + 2 * triplePct) * (1 + 4 * fivePct);
  const rodMult = (skillOptions?.fishingRodCardTier != null) ? FISHING_ROD_CARD_MULT[skillOptions.fishingRodCardTier] : 1;
  const baseRod = Math.round(stats.fishing_rod_power * rodMult); // round only once, after card mult
  const polyCardTotalMulti = (4 + stats.poly_card_gain_multi) * (skillOptions?.valuePackPotencyPoly ? 1.15 : 1);
  const fishCardTier = skillOptions?.fishCardTier ?? {};
  const tickOpts = {
    motleySchoolLevel: skillOptions?.skillTreeLevels?.["motley_school"] ?? 0,
    enhanceT2DockTicksLevel: enhanceLevels["enhance_tier2_dock_ticks"] ?? 0,
    abyssLegendaryCaught: skillOptions?.abyssLegendaryCaught ?? false,
  };
  let total = 0;
  for (const set of AQUARIUM) {
    const dock = DOCKS.find((d) => d.id === set.dockId)!;
    const ticksNeeded = getEffectiveTicksNeeded(dock, tickOpts);
    const rod = activeDockId === set.dockId ? baseRod : 0;
    const n = dronesPerDock[set.dockId] ?? 0;
    const isT2 = dock.tier === 2;
    const powerOnThisDock = isT2
      ? (rod + n * stats.drone_base_power) * stats.tier2_dock_power_mult
      : rod + n * stats.drone_base_power;
    const dockFillsPerHour = 3600 / (ticksNeeded * effectiveTickSec);
    const fillsPerHour = dockFillsPerHour + extraTicksPerHour / ticksNeeded;
    for (const f of set.fish) {
      const tier = (fishCardTier[f.id] ?? 0) as FishCardTier;
      const cardMulti = tier === 1 ? 1.5 : tier === 2 ? 2 : tier === 3 ? polyCardTotalMulti : 1;
      total +=
        fillsPerHour *
        expectedRollsPerFill *
        expectedCatchesPerRoll(powerOnThisDock, f.powerRating) *
        stats.fish_income_multi *
        expectedShinyMulti *
        cardMulti;
    }
  }
  return total;
}

/**
 * Greedy dock assignment for +% gains: rod and all drones on the highest unlocked dock (last in progression).
 * E.g. if you just unlocked T2 and Cave is your top dock, everything is assumed on Cave. Marginal % then reflects gain when everything is concentrated on that one dock.
 */
export function getGreedyDockAssignment(
  upgradeLevels: Partial<Record<FishingUpgradeId, number>>,
  enhanceLevels: Partial<Record<EnhanceId, number>>,
  skillOptions: TotalFishOptions,
  _elixir3xFishingExternal: { uptimeFraction: number },
  _extraTicksPerHour: number,
): { activeDockId: DockId; dronesPerDock: Record<DockId, number> } {
  const stats = computeFishingStatsFromLevels(upgradeLevels, enhanceLevels, skillOptions);
  const droneCap = Math.floor(stats.fishing_drone_cap);
  const availableDocks = DOCKS.filter((d, i) => {
    if (d.tier === 1) return stats.boat_level >= i;
    return (stats.t2_boat_level ?? 0) >= i - 5;
  });
  if (availableDocks.length === 0) {
    const fallback: Record<DockId, number> = {} as Record<DockId, number>;
    DOCKS.forEach((d) => (fallback[d.id] = 0));
    return { activeDockId: DOCKS[0]!.id as DockId, dronesPerDock: fallback };
  }
  const maxDock = availableDocks[availableDocks.length - 1]!;
  const dronesPerDock: Record<DockId, number> = {} as Record<DockId, number>;
  for (const d of DOCKS) dronesPerDock[d.id as DockId] = d.id === maxDock.id ? droneCap : 0;
  return { activeDockId: maxDock.id as DockId, dronesPerDock };
}

/** Same formula as computeTotalFishPerHour but from precomputed stats (for skill breakdown). Includes extraTicksPerHour so breakdown totals match main total. effectiveTicksByDock: use when caller has it (Motley School, T2 Dock Ticks, Abyss Legendary). */
export function computeTotalFishPerHourFromStats(
  stats: ComputedFishingStats,
  dronesPerDock: Record<DockId, number>,
  activeDockId: DockId,
  elixir3xFishingExternal: { uptimeFraction: number },
  effectiveRodPowerOverride?: number,
  extraTicksPerHour: number = 0,
  effectiveTicksByDock?: Partial<Record<DockId, number>>,
): number {
  const s = stats.shiny_fish_chance_pct / 100;
  const s2 = stats.super_shiny_chance_pct / 100;
  const expectedShinyMulti =
    (1 - s) * 1 +
    s * (1 - s2) * stats.shiny_multiplier +
    s * s2 * stats.shiny_multiplier * stats.super_shiny_multiplier;
  const tickDurationSec = Math.max(1, 60 + stats.fishing_tick_reduction);
  const effectiveTickSec = effectiveFishingTickSec(tickDurationSec, elixir3xFishingExternal.uptimeFraction);
  const doublePct = stats.double_tick_chance_pct / 100;
  const triplePct = stats.triple_tick_chance_pct / 100;
  const fivePct = stats.five_tick_chance_pct / 100;
  const expectedRollsPerFill = (1 + doublePct) * (1 + 2 * triplePct) * (1 + 4 * fivePct);
  const rodForActive = effectiveRodPowerOverride ?? stats.fishing_rod_power;
  let total = 0;
  for (const set of AQUARIUM) {
    const dock = DOCKS.find((d) => d.id === set.dockId)!;
    const ticksNeeded = effectiveTicksByDock?.[dock.id] ?? dock.baseTicksNeeded;
    const rod = activeDockId === set.dockId ? rodForActive : 0;
    const n = dronesPerDock[set.dockId] ?? 0;
    const isT2 = dock.tier === 2;
    const powerOnThisDock = isT2
      ? (rod + n * stats.drone_base_power) * stats.tier2_dock_power_mult
      : rod + n * stats.drone_base_power;
    const dockFillsPerHour = 3600 / (ticksNeeded * effectiveTickSec);
    const fillsPerHour = dockFillsPerHour + extraTicksPerHour / ticksNeeded;
    for (const f of set.fish) {
      total +=
        fillsPerHour *
        expectedRollsPerFill *
        expectedCatchesPerRoll(powerOnThisDock, f.powerRating) *
        stats.fish_income_multi *
        expectedShinyMulti;
    }
  }
  return total;
}
// ———————————————————— new: options builders ————————————————————

/**
 * Everything the model needs besides {@link FishingState}: values that live in other modules
 * (Drone / Lootbug / Gem EV) and are read from `localStorage` by `external.ts`. All fields optional (0 = none).
 */
export type FishingContext = {
  /** Fraction (0..1) of time the Drone module's Elixir 3x fishing tick buff is active. */
  elixir3xUptimeFraction?: number;
  /** Extra tick-bar units per hour (Angler + Lootbug +12 ticks + Gift/Lootfrog Sushi + Workshop sushi ticks). */
  extraTicksPerHour?: number;
  /** Gems per hour (Gem EV page). 0 / undefined = unknown. */
  gemsPerHour?: number;
};

/**
 * All state fields that influence fish/h, as the options object consumed by
 * {@link computeTotalFishPerHour} / `computeFishingStatsFromLevels`.
 * Includes `valuePackPotencyPoly` and `superStarsLevel` (the classic marginal memos used to omit them).
 */
export function buildTotalFishOptions(state: FishingState): TotalFishOptions {
  return {
    skillTreeLevels: state.skillTreeLevels,
    fishCardTier: state.fishCardTier,
    valuePackPotencyPoly: state.valuePackPotencyPoly,
    legendaryFishFound: state.legendaryFishFound,
    abyssLegendaryCaught: state.abyssLegendaryCaught,
    fishingRodCardTier: state.fishingRodCardTier,
    mrNibblesCardTier: state.mrNibblesCardTier,
    relic5xPoints: state.divineRelic5xPoints,
    mrNibblesLevel: state.mrNibblesLevel,
    mrNibblesQuestUnlocked: state.mrNibblesQuestUnlocked,
    mrNibblesQuestRank: state.mrNibblesQuestRank,
    mrNibblesSkin: state.mrNibblesSkin,
    poseidonIdolLevel: state.poseidonIdolLevel,
    tethysIdolLevel: state.tethysIdolLevel,
    astraeusIdolLevel: state.astraeusIdolLevel,
    droneBasePowerWorld3Upgrade: state.droneBasePowerWorld3Upgrade,
    fishingDroneBasePowerWorld3: state.fishingDroneBasePowerWorld3,
    legendaryHaulerBundle: state.legendaryHaulerBundle,
    fishersBundle: state.fishersBundle,
    anglerBundle: state.anglerBundle,
    halfWayBundle: state.halfWayBundle,
    divineChallengeCoinLevel: state.divineChallengeCoinLevel,
    infernalMrNibblesPct: state.infernalMrNibblesPct,
    infernalMrNibblesLevel: state.infernalMrNibblesLevel,
    infernalAnglerDronePct: state.infernalAnglerDronePct,
    infernalAnglerDroneLevel: state.infernalAnglerDroneLevel,
    constructStatue: state.constructStatue,
    cetusLevel: state.cetusLevel,
    superStarsLevel: state.superStarsLevel,
    blackHoleBonus: state.blackHoleBonus,
  };
}

/** Options for `computeFishingStatsFromLevels` built from state (what the classic page called `skillTreeOptions`). */
export function buildSkillTreeOptions(state: FishingState): SkillTreeOptions {
  return buildTotalFishOptions(state);
}

/** Docks reachable with the given boat levels (T1: boat >= index; T2: t2 boat >= index - 5). */
export function getUnlockedDockIds(boatLevel: number, t2BoatLevel: number): DockId[] {
  return DOCKS.filter((d, i) => (d.tier === 1 ? boatLevel >= i : t2BoatLevel >= i - 5)).map((d) => d.id);
}

/** Expected fish multiplier from Shiny / Super Shiny (super only rolls when already shiny). */
export function expectedShinyMultiFromStats(stats: ComputedFishingStats): number {
  const s = stats.shiny_fish_chance_pct / 100;
  const s2 = stats.super_shiny_chance_pct / 100;
  return (1 - s) + s * (1 - s2) * stats.shiny_multiplier + s * s2 * stats.shiny_multiplier * stats.super_shiny_multiplier;
}

/** Expected dock-fill rolls per fill from double / triple / 5x tick chances. */
export function expectedRollsPerFillFromStats(stats: ComputedFishingStats): number {
  return (
    (1 + stats.double_tick_chance_pct / 100) *
    (1 + 2 * stats.triple_tick_chance_pct / 100) *
    (1 + 4 * stats.five_tick_chance_pct / 100)
  );
}

/** Card multiplier for a tier: none 1x, Card 1.5x, Gilded 2x, Poly = (4 + gain multi) x Potency 1.15. */
export function cardMultiplierForTier(tier: FishCardTier, polyTotalMulti: number): number {
  return tier === 1 ? 1.5 : tier === 2 ? 2 : tier === 3 ? polyTotalMulti : 1;
}

// ———————————————————— new: engine (shared by snapshot / placement / ranking) ————————————————————

type Engine = {
  stats: ComputedFishingStats;
  /** Rod power after Fishing Rod card multiplier (rounded once). */
  rodPower: number;
  tickDurationSec: number;
  effectiveTickSec: number;
  expectedRolls: number;
  expectedShiny: number;
  polyTotalMulti: number;
  extraTicksPerHour: number;
  ticksByDock: Record<DockId, number>;
  droneCap: number;
  unlocked: DockId[];
  cardTier: (fishId: string) => FishCardTier;
  power: (dockId: DockId, rod: number, drones: number) => number;
  fillsPerHour: (dockId: DockId) => number;
  fishPerHour: (dockId: DockId, fish: FishDef, power: number) => number;
};

function makeEngine(state: FishingState, ctx: FishingContext): Engine {
  const opts = buildTotalFishOptions(state);
  const stats = computeFishingStatsFromLevels(state.upgradeLevels ?? {}, state.enhanceLevels ?? {}, opts);
  const tickOpts = {
    motleySchoolLevel: state.skillTreeLevels?.["motley_school"] ?? 0,
    enhanceT2DockTicksLevel: state.enhanceLevels?.["enhance_tier2_dock_ticks"] ?? 0,
    abyssLegendaryCaught: state.abyssLegendaryCaught ?? false,
  };
  const ticksByDock = {} as Record<DockId, number>;
  for (const d of DOCKS) ticksByDock[d.id] = getEffectiveTicksNeeded(d, tickOpts);
  const tickDurationSec = Math.max(1, 60 + stats.fishing_tick_reduction);
  const effectiveTickSec = effectiveFishingTickSec(tickDurationSec, ctx.elixir3xUptimeFraction ?? 0);
  const extraTicksPerHour = ctx.extraTicksPerHour ?? 0;
  const rodMult = FISHING_ROD_CARD_MULT[state.fishingRodCardTier ?? 0];
  const polyTotalMulti = (4 + stats.poly_card_gain_multi) * (state.valuePackPotencyPoly ? 1.15 : 1);
  const expectedRolls = expectedRollsPerFillFromStats(stats);
  const expectedShiny = expectedShinyMultiFromStats(stats);
  const fishCardTier = state.fishCardTier ?? {};
  const dockById = new Map(DOCKS.map((d) => [d.id, d]));
  const fillsPerHour = (dockId: DockId): number => {
    const t = ticksByDock[dockId];
    return 3600 / (t * effectiveTickSec) + extraTicksPerHour / t;
  };
  return {
    stats,
    rodPower: Math.round(stats.fishing_rod_power * rodMult),
    tickDurationSec,
    effectiveTickSec,
    expectedRolls,
    expectedShiny,
    polyTotalMulti,
    extraTicksPerHour,
    ticksByDock,
    droneCap: Math.floor(stats.fishing_drone_cap),
    unlocked: getUnlockedDockIds(stats.boat_level, stats.t2_boat_level ?? 0),
    cardTier: (fishId) => (fishCardTier[fishId] ?? 0) as FishCardTier,
    power: (dockId, rod, drones) => {
      const p = rod + drones * stats.drone_base_power;
      return dockById.get(dockId)!.tier === 2 ? p * stats.tier2_dock_power_mult : p;
    },
    fillsPerHour,
    fishPerHour: (dockId, fish, power) => {
      const tier = (fishCardTier[fish.id] ?? 0) as FishCardTier;
      return (
        fillsPerHour(dockId) *
        expectedRolls *
        expectedCatchesPerRoll(power, fish.powerRating) *
        stats.fish_income_multi *
        expectedShiny *
        cardMultiplierForTier(tier, polyTotalMulti)
      );
    },
  };
}

function dockTotal(e: Engine, dockId: DockId, power: number): number {
  const set = AQUARIUM.find((s) => s.dockId === dockId)!;
  let t = 0;
  for (const f of set.fish) t += e.fishPerHour(dockId, f, power);
  return t;
}

// ———————————————————— new: snapshot ————————————————————

/** Derived stats shown in "Your stats". */
export type FishingStatsSnapshot = {
  /** Rod power from upgrades/enhance/skills/bundle, NOT rounded and without rod card (e.g. 273.504). */
  rodPowerExact: number;
  /** Rod power actually used on the rod's dock: round(exact x rod card multiplier). */
  rodPower: number;
  /** Max drones you can assign (floor of the raw cap). */
  droneCap: number;
  /** Raw (possibly fractional) drone cap from the stats. */
  droneCapExact: number;
  /** Power of one drone (base x multiplier). */
  dronePower: number;
  /** Total drone power multiplier (upgrade x enhance x skills x ...). */
  droneMulti: number;
  /** Fish income multiplier (all sources). */
  incomeMulti: number;
  /** Base seconds per tick after tick-speed reductions (>= 1). */
  tickSeconds: number;
  /** Seconds per tick incl. Elixir 3x buff uptime. */
  effectiveTickSeconds: number;
  doubleTickPct: number;
  tripleTickPct: number;
  fiveTickPct: number;
  /** Expected dock-fill rolls per fill = (1+double)(1+2 triple)(1+4 five). */
  expectedRollsPerFill: number;
  shinyChancePct: number;
  superShinyChancePct: number;
  /** Expected fish multiplier from shiny / super shiny. */
  expectedShinyMulti: number;
  tier2DockPowerMult: number;
  tokenMulti: number;
  tinyNoticePct: number;
  boatLevel: number;
  t2BoatLevel: number;
  /** The full output of `computeFishingStatsFromLevels` for anything not listed above. */
  raw: ComputedFishingStats;
};

export type FishSnapshot = {
  fishId: string;
  name: string;
  powerRating: number;
  cardTier: FishCardTier;
  /** Catch chance in percent (can exceed 100: guaranteed catches + chance of one more; cap 999). */
  catchChancePct: number;
  /** Expected fish per hour (fills x rolls x catches x income x shiny x card). */
  perHour: number;
};

export type DockLimit = "power" | "ticks" | "locked";

export type DockSnapshot = {
  dockId: DockId;
  name: string;
  tier: 1 | 2;
  unlocked: boolean;
  /** Effective ticks to fill the dock meter (Motley School / T2 ticks / Cthulhu applied). */
  ticksNeeded: number;
  /** Dock fills per hour incl. Elixir buff and extra ticks (Angler, sushi, ...). */
  fillsPerHour: number;
  /** Power on this dock (rod if assigned + drones, x T2 mult on T2 docks). */
  powerOnDock: number;
  dronesAssigned: number;
  /** True when the rod is on this dock. */
  hasRod: boolean;
  /** Sum of `fish[].perHour` (0 for locked docks). */
  fishPerHour: number;
  fish: FishSnapshot[];
  /**
   * What caps this dock's output: "locked" (boat), "power" (the rarest fish is caught < 100% of the time: more
   * power helps more than anything), "ticks" (all 4 fish >= 100%: speed / multipliers / drones elsewhere matter).
   */
  limitedBy: DockLimit;
};

export type FishingSnapshot = {
  stats: FishingStatsSnapshot;
  /** Sum of all unlocked docks' fish per hour (regular fish only; legendary fish excluded). */
  totalFishPerHour: number;
  /** One entry per dock in game order (locked ones included with `unlocked: false`). */
  docks: DockSnapshot[];
  /** Fish per hour by fish id (only unlocked docks; locked docks' fish are 0). */
  fishRates: Record<string, number>;
  /** Drones assigned on unlocked docks. */
  dronesAssigned: number;
  /** Max drones (floor of cap). */
  droneCap: number;
};

/**
 * Full fish/h picture for the user's CURRENT dock assignment (`state.dronesPerDock`, `state.activeDockId`).
 * Pure and fast (one pass over 11 docks x 4 fish).
 */
export function computeFishingSnapshot(state: FishingState, ctx: FishingContext = {}): FishingSnapshot {
  const e = makeEngine(state, ctx);
  const s = e.stats;
  const unlocked = new Set(e.unlocked);
  const fishRates: Record<string, number> = {};
  let total = 0;
  let assigned = 0;
  const docks: DockSnapshot[] = DOCKS.map((dock) => {
    const set = AQUARIUM.find((x) => x.dockId === dock.id)!;
    const isUnlocked = unlocked.has(dock.id);
    const n = state.dronesPerDock?.[dock.id] ?? 0;
    const hasRod = state.activeDockId === dock.id;
    const power = e.power(dock.id, hasRod ? e.rodPower : 0, n);
    if (isUnlocked) assigned += n;
    const fish: FishSnapshot[] = set.fish.map((f) => {
      const perHour = isUnlocked ? e.fishPerHour(dock.id, f, power) : 0;
      fishRates[f.id] = perHour;
      return {
        fishId: f.id,
        name: f.name,
        powerRating: f.powerRating,
        cardTier: e.cardTier(f.id),
        catchChancePct: catchChancePercent(power, f.powerRating),
        perHour,
      };
    });
    const fishPerHour = fish.reduce((a, f) => a + f.perHour, 0);
    total += fishPerHour;
    const last = fish[fish.length - 1]!;
    const limitedBy: DockLimit = !isUnlocked ? "locked" : last.catchChancePct < 100 ? "power" : "ticks";
    return {
      dockId: dock.id,
      name: dock.name,
      tier: dock.tier,
      unlocked: isUnlocked,
      ticksNeeded: e.ticksByDock[dock.id],
      fillsPerHour: e.fillsPerHour(dock.id),
      powerOnDock: power,
      dronesAssigned: n,
      hasRod,
      fishPerHour,
      fish,
      limitedBy,
    };
  });
  return {
    stats: {
      rodPowerExact: s.fishing_rod_power,
      rodPower: e.rodPower,
      droneCap: e.droneCap,
      droneCapExact: s.fishing_drone_cap,
      dronePower: s.drone_base_power,
      droneMulti: s.drone_power_multiplier,
      incomeMulti: s.fish_income_multi,
      tickSeconds: e.tickDurationSec,
      effectiveTickSeconds: e.effectiveTickSec,
      doubleTickPct: s.double_tick_chance_pct,
      tripleTickPct: s.triple_tick_chance_pct,
      fiveTickPct: s.five_tick_chance_pct,
      expectedRollsPerFill: e.expectedRolls,
      shinyChancePct: s.shiny_fish_chance_pct,
      superShinyChancePct: s.super_shiny_chance_pct,
      expectedShinyMulti: e.expectedShiny,
      tier2DockPowerMult: s.tier2_dock_power_mult,
      tokenMulti: s.token_gain_multi,
      tinyNoticePct: s.tiny_notice_chance_pct,
      boatLevel: s.boat_level,
      t2BoatLevel: s.t2_boat_level ?? 0,
      raw: s,
    },
    totalFishPerHour: total,
    docks,
    fishRates,
    dronesAssigned: assigned,
    droneCap: e.droneCap,
  };
}

// ———————————————————— new: concentrated-assignment helpers (used by ranking) ————————————————————

/** Highest unlocked dock (last in progression) for the given state. */
export function getTopUnlockedDockId(state: FishingState): DockId {
  const s = computeFishingStatsFromLevels(state.upgradeLevels ?? {}, state.enhanceLevels ?? {}, buildTotalFishOptions(state));
  const ids = getUnlockedDockIds(s.boat_level, s.t2_boat_level ?? 0);
  return ids[ids.length - 1] ?? DOCKS[0]!.id;
}

/**
 * Total fish/h if the rod and ALL drones (floor of cap) sit on `dockId`. This is the dock-independent
 * basis used for marginal gains: power-like upgrades give the same % on any dock (catches are linear in power below the 999% cap).
 */
export function computeConcentratedFishPerHour(state: FishingState, ctx: FishingContext, dockId: DockId): number {
  const e = makeEngine(state, ctx);
  return dockTotal(e, dockId, e.power(dockId, e.rodPower, e.droneCap));
}

/**
 * Fish/h of one specific fish when the rod and all drones are focused on that fish's dock
 * (what you would farm at if you moved everything there). 0 when the dock is locked.
 */
export function fishRateWhenFocused(state: FishingState, ctx: FishingContext, fishId: string): number {
  const e = makeEngine(state, ctx);
  const set = AQUARIUM.find((s) => s.fish.some((f) => f.id === fishId));
  if (!set || !e.unlocked.includes(set.dockId)) return 0;
  const f = set.fish.find((x) => x.id === fishId)!;
  return e.fishPerHour(set.dockId, f, e.power(set.dockId, e.rodPower, e.droneCap));
}

/** The dock a fish is caught on. */
export function getDockIdForFish(fishId: string): DockId | undefined {
  return AQUARIUM.find((s) => s.fish.some((f) => f.id === fishId))?.dockId;
}

// ———————————————————— new: drone placement suggestion ————————————————————

/** What to optimise when suggesting where the rod and drones go. */
export type PlacementGoal =
  /** Everything on the highest unlocked dock (the classic "greedy" assumption). */
  | { kind: "top-dock" }
  /** Maximise total fish/h (sum of fish counts): optimal drone split + best rod dock. Tends to favour fast low docks. */
  | { kind: "max-fish" }
  /** Farm one specific fish (e.g. an upgrade's cost fish): rod and all drones on its dock. */
  | { kind: "farm-fish"; fishId: string };

export type PlacementSuggestion = {
  goal: PlacementGoal["kind"];
  activeDockId: DockId;
  dronesPerDock: Record<DockId, number>;
  /** Total fish/h with this placement. */
  totalFishPerHour: number;
  /** Fish/h of the targeted fish (farm-fish goal only). */
  targetFishPerHour?: number;
};

function emptyDrones(): Record<DockId, number> {
  const out = {} as Record<DockId, number>;
  for (const d of DOCKS) out[d.id] = 0;
  return out;
}

function totalFor(e: Engine, drones: Record<DockId, number>, rodDock: DockId): number {
  let t = 0;
  for (const dockId of e.unlocked) {
    t += dockTotal(e, dockId, e.power(dockId, rodDock === dockId ? e.rodPower : 0, drones[dockId] ?? 0));
  }
  return t;
}

/**
 * Suggest where to put the rod and the drones. Pure; does not read the state's current assignment.
 * - `top-dock`: classic greedy (everything on the highest dock).
 * - `max-fish`: catches are linear in power until the 999% cap (concave), so a one-drone-at-a-time greedy split
 *   is optimal for a fixed rod dock; the best rod dock is tried for each unlocked dock.
 * - `farm-fish`: everything on the dock that yields the fish (falls back to the top dock if it is locked).
 */
export function suggestDronePlacement(
  state: FishingState,
  ctx: FishingContext = {},
  goal: PlacementGoal = { kind: "top-dock" },
): PlacementSuggestion {
  const e = makeEngine(state, ctx);
  const top = e.unlocked[e.unlocked.length - 1] ?? DOCKS[0]!.id;
  const concentrate = (dockId: DockId, kind: PlacementGoal["kind"]): PlacementSuggestion => {
    const drones = emptyDrones();
    drones[dockId] = e.droneCap;
    return { goal: kind, activeDockId: dockId, dronesPerDock: drones, totalFishPerHour: totalFor(e, drones, dockId) };
  };
  if (goal.kind === "top-dock") return concentrate(top, "top-dock");
  if (goal.kind === "farm-fish") {
    const d = getDockIdForFish(goal.fishId);
    const dockId = d && e.unlocked.includes(d) ? d : top;
    const res = concentrate(dockId, "farm-fish");
    const set = AQUARIUM.find((s) => s.dockId === dockId)!;
    const f = set.fish.find((x) => x.id === goal.fishId);
    if (f) res.targetFishPerHour = e.fishPerHour(dockId, f, e.power(dockId, e.rodPower, e.droneCap));
    return res;
  }
  // max-fish
  let best: PlacementSuggestion | null = null;
  for (const rodDock of e.unlocked) {
    const drones = emptyDrones();
    const value: Record<string, number> = {};
    for (const d of e.unlocked) value[d] = dockTotal(e, d, e.power(d, rodDock === d ? e.rodPower : 0, 0));
    for (let i = 0; i < e.droneCap; i++) {
      let bestDock: DockId | null = null;
      let bestGain = 0;
      let bestVal = 0;
      for (const d of e.unlocked) {
        const v = dockTotal(e, d, e.power(d, rodDock === d ? e.rodPower : 0, drones[d] + 1));
        const g = v - value[d]!;
        if (g > bestGain) {
          bestGain = g;
          bestDock = d;
          bestVal = v;
        }
      }
      if (!bestDock) {
        // Every dock is capped: remaining drones are irrelevant; park them on the rod dock.
        drones[rodDock] += e.droneCap - i;
        break;
      }
      drones[bestDock] += 1;
      value[bestDock] = bestVal;
    }
    const total = totalFor(e, drones, rodDock);
    if (!best || total > best.totalFishPerHour) {
      best = { goal: "max-fish", activeDockId: rodDock, dronesPerDock: drones, totalFishPerHour: total };
    }
  }
  return best ?? concentrate(top, "max-fish");
}

/**
 * Build the model context from state + the Drone / Lootbug / Gem EV values (see `external.ts`).
 * `extraTicksPerHour` = Angler + Lootbug +12 ticks + Gift sushi + Lootfrog sushi (x ticks per sushi) + Workshop sushi ticks
 * (same sum the classic page uses for fills/h).
 */
export function buildFishingContext(
  state: FishingState,
  ext: Pick<
    FishingExternalData,
    "elixir3xFishingExternal" | "anglerTicksPerHour" | "lootbugFishing12TicksProcsPerHour" | "giftSushiPerHour" | "lootfrogSushiPerHour"
  >,
  gemsPerHour = 0,
): FishingContext {
  const ticksPerSushi = SUSHI_BASE_TICKS + SUSHI_CARD_TICKS[state.sushiCardTier];
  return {
    elixir3xUptimeFraction: ext.elixir3xFishingExternal.uptimeFraction,
    extraTicksPerHour:
      ext.anglerTicksPerHour +
      ext.lootbugFishing12TicksProcsPerHour +
      ext.giftSushiPerHour * ticksPerSushi +
      ext.lootfrogSushiPerHour * ticksPerSushi +
      (state.workshopSushiTicksWorld3 ?? 0),
    gemsPerHour,
  };
}
