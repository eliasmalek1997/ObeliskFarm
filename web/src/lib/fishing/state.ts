/**
 * Fishing persisted state: types, defaults, load/save.
 *
 * The storage key and every field name are kept identical to the original Fishing.tsx so existing saves
 * (and `lib/importStats.ts`, which writes into the same key) keep working. Only add new OPTIONAL fields
 * with defaults; never rename or remove fields.
 */

import { loadJson, saveJson } from "../storage";
import { computeFishingStatsFromLevels } from "./computeStats";
import { DOCKS } from "./constants";
import type { DockId, EnhanceId, FishingSkillId, FishingUpgradeId } from "./types";

/** Fish card tier: 0 = none, 1 = Card (1.5×), 2 = Gilded (2×), 3 = Poly (4× base). */
export type FishCardTier = 0 | 1 | 2 | 3;

/** Shape read from disk: every field optional (older saves lack newer fields). */
export type SavedState = {
  dronesPerDock?: Partial<Record<DockId, number>>;
  activeDockId?: DockId | null;
  showDisabledFishGrayed?: boolean;
  showPolyShardDroprate?: boolean;
  useGemIncomeForCostEffic?: boolean;
  upgradeLevels?: Partial<Record<FishingUpgradeId, number>>;
  enhanceLevels?: Partial<Record<EnhanceId, number>>;
  fishCardTier?: Partial<Record<string, FishCardTier>>;
  sushiCardTier?: FishCardTier;
  fishingRodCardTier?: FishCardTier;
  valuePackPotencyPoly?: boolean;
  skillTreeLevels?: Partial<Record<FishingSkillId, number>>;
  legendaryFishFound?: number;
  /** Abyss Legendary (Cthulhu) caught: Abyss dock tick req -9 (more dock fills/h). */
  abyssLegendaryCaught?: boolean;
  /** Divine Relic points: +2% 5× tick chance per point (applies to all gains; Sushi does not get Gift +25%). */
  divineRelic5xPoints?: number;
  /** Variance (MC) simulation: hours to simulate. Default 8. */
  mcHours?: number;
  /** Variance (MC) simulation: number of runs (dock fill MC). Default 1000. */
  mcRuns?: number;
  /** Sushi variance MC: how many Sushi openings to simulate. Default 1000. */
  sushiMcSushis?: number;
  /** Pets: Mr Nibbles level. */
  mrNibblesLevel?: number;
  /** Pets: Mr Nibbles Quest unlocked (rank 0 = +5% T2 Dock Power). */
  mrNibblesQuestUnlocked?: boolean;
  /** Pets: Mr Nibbles Quest rank (0-based; only when unlocked). */
  mrNibblesQuestRank?: number;
  /** Pets: Mr Nibbles Pet Skin. +2% Shiny Fish Chance (flat). */
  mrNibblesSkin?: boolean;
  poseidonIdolLevel?: number;
  tethysIdolLevel?: number;
  astraeusIdolLevel?: number;
  fishingDroneBasePowerWorld3?: number;
  workshopSushiTicksWorld3?: number;
  legendaryHaulerBundle?: boolean;
  fishersBundle?: boolean;
  /** Store: Angler's Bundle. +6% Tiny Notice Chance (flat). */
  anglerBundle?: boolean;
  /** Store: Half Way Bundle! Fishing Rod Power ×1.10. */
  halfWayBundle?: boolean;
  /** Divine Challenge Coin: each level gives Shiny Fish Multiplier +10%. */
  divineChallengeCoinLevel?: number;
  /** Construct: Statue Craftmanship. At most one: gilded (×1.25) or platinized (×1.40) fish income. */
  constructStatue?: "none" | "gilded" | "platinized";
  /** Stargazing: Cetus level. +2% Fish Income per level. */
  cetusLevel?: number;
  /** Stargazing: Super Stars Fish Income Multiplier. +1.25% per level. */
  superStarsLevel?: number;
  /** Stargazing: Black Hole Bonus. Tier 2 Dock Power +25%. */
  blackHoleBonus?: boolean;
  /** Upgrades: Fishing Drone Power (World 3). +0.1 base drone power per level. */
  droneBasePowerWorld3Upgrade?: number;
  /** Cards: Infernal Mr Nibbles — % per level (flat 5× tick chance). */
  infernalMrNibblesPct?: number;
  /** Cards: Infernal Mr Nibbles — level. */
  infernalMrNibblesLevel?: number;
  /** Cards: Infernal Angler Drone Card — % per level (Tier 2 Dock Power). */
  infernalAnglerDronePct?: number;
  /** Cards: Infernal Angler Drone Card — level. */
  infernalAnglerDroneLevel?: number;
  /** Cards: Mr Nibbles Card. 0 = none, 1 = +1% Tiny Notice, 2 = Gilded +2%, 3 = Poly +4%. */
  mrNibblesCardTier?: FishCardTier;
};

/** Single persisted state (same pattern as Drone: one state, lazy load, save on change). */
export type FishingState = {
  dronesPerDock: Record<DockId, number>;
  activeDockId: DockId;
  showDisabledFishGrayed: boolean;
  showPolyShardDroprate: boolean;
  useGemIncomeForCostEffic: boolean;
  upgradeLevels: Partial<Record<FishingUpgradeId, number>>;
  enhanceLevels: Partial<Record<EnhanceId, number>>;
  fishCardTier: Partial<Record<string, FishCardTier>>;
  /** Sushi Misc card: 0 = none, 1 = Card +5 ticks, 2 = Gilded +10, 3 = Poly +20. */
  sushiCardTier: FishCardTier;
  /** Fishing Rod card: 0 = none, 1 = Card 1.02×, 2 = Gilded 1.05×, 3 = Poly 1.10× rod power. */
  fishingRodCardTier: FishCardTier;
  /** Cards: Mr Nibbles Card. 0 = none, 1 = Card +1% Tiny Notice, 2 = Gilded +2%, 3 = Poly +4%. */
  mrNibblesCardTier: FishCardTier;
  valuePackPotencyPoly: boolean;
  skillTreeLevels: Partial<Record<FishingSkillId, number>>;
  legendaryFishFound: number;
  /** Abyss Legendary (Cthulhu) caught: Abyss dock tick req -9 (more dock fills/h). */
  abyssLegendaryCaught: boolean;
  /** Divine Relic points: +2% 5× tick chance per point. */
  divineRelic5xPoints: number;
  /** Variance (MC) simulation: hours to simulate. Default 8. */
  mcHours: number;
  /** Variance (MC) simulation: number of runs (dock fill MC). Default 1000. */
  mcRuns: number;
  /** Sushi variance MC: simulated Sushi count. Default 1000. */
  sushiMcSushis: number;
  /** Pets: Mr Nibbles level. +0.03× Shiny Multi per level (own mult), +1% Triple Tick Chance per level (flat). */
  mrNibblesLevel: number;
  /** Pets: Mr Nibbles Quest unlocked. When true, rank 0 = +5% T2 Dock Power (own mult). */
  mrNibblesQuestUnlocked: boolean;
  /** Pets: Mr Nibbles Quest rank (0-based). Mult = 1 + 0.05×(rank+1) when unlocked. */
  mrNibblesQuestRank: number;
  /** Pets: Mr Nibbles Pet Skin. +2% Shiny Fish Chance (flat). */
  mrNibblesSkin: boolean;
  /** Archaeology: Poseidon Idol level. +0.25 base drone power per level. */
  poseidonIdolLevel: number;
  /** Archaeology: Tethys Idol level. Tier 2 +0.05%, Drone multi +0.05%, Super shiny multi +0.05% per level. */
  tethysIdolLevel: number;
  /** Archaeology: Astraeus Idol level. +0.03% double tick chance per level (flat). */
  astraeusIdolLevel: number;
  /** Upgrades: Fishing Drone Power (World 3). +0.1 base drone power per level. */
  droneBasePowerWorld3Upgrade: number;
  /** Workshop: Fishing Drone Power (World 3). +0.02x multiplier per level. */
  fishingDroneBasePowerWorld3: number;
  /** Workshop: Sushi Fishing Ticks (World 3). +1 extra sushi tick per hour per level. */
  workshopSushiTicksWorld3: number;
  /** Store: Legendary Hauler Bundle. +3% 5× tick, Fish Income ×1.10, T2 Dock Power ×1.10. */
  legendaryHaulerBundle: boolean;
  /** Store: Fisher's Bundle. +10% triple tick chance. */
  fishersBundle: boolean;
  /** Store: Angler's Bundle. +6% Tiny Notice Chance (flat). */
  anglerBundle: boolean;
  /** Store: Half Way Bundle! Fishing Rod Power ×1.10. */
  halfWayBundle: boolean;
  /** Divine Challenge Coin: each level gives Shiny Fish Multiplier +10%. */
  divineChallengeCoinLevel: number;
  /** Construct: Statue Craftmanship. At most one: gilded (×1.25 fish income) or platinized (×1.40). */
  constructStatue: "none" | "gilded" | "platinized";
  /** Stargazing: Cetus level. +2% Fish Income per level (own mult). */
  cetusLevel: number;
  /** Stargazing: Super Stars Fish Income Multiplier. +1.25% per level (own mult). */
  superStarsLevel: number;
  /** Stargazing: Black Hole Bonus. Tier 2 Dock Power +25%. */
  blackHoleBonus: boolean;
  /** Cards: Infernal Mr Nibbles — % per level (flat 5× tick chance). */
  infernalMrNibblesPct: number;
  /** Cards: Infernal Mr Nibbles — level. */
  infernalMrNibblesLevel: number;
  /** Cards: Infernal Angler Drone Card — % per level (Tier 2 Dock Power). */
  infernalAnglerDronePct: number;
  /** Cards: Infernal Angler Drone Card — level. */
  infernalAnglerDroneLevel: number;
};

/** localStorage key of the Fishing save (whole {@link FishingState} as JSON). Do not change. */
export const FISHING_STORAGE_KEY = "obeliskfarm:web:fishing_save.json:v1";

/** Sushi MC: min/max simulated openings (each = one Poisson draw for fish per Sushi). */
export const SUSHI_MC_SUSHIS_MIN = 100;
export const SUSHI_MC_SUSHIS_MAX = 100_000;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Fresh default state (no upgrades, all drones on Lake). */
export function getDefaultFishingState(): FishingState {
  const upgradeLevels: Partial<Record<FishingUpgradeId, number>> = {};
  const enhanceLevels: Partial<Record<EnhanceId, number>> = {};
  const computed = computeFishingStatsFromLevels(upgradeLevels, enhanceLevels);
  const dronesPerDock: Record<DockId, number> = {} as Record<DockId, number>;
  DOCKS.forEach((d, i) => {
    dronesPerDock[d.id] = i === 0 ? Math.max(0, Math.round(computed.fishing_drone_cap)) : 0;
  });
  return {
    dronesPerDock,
    showDisabledFishGrayed: false,
    showPolyShardDroprate: true,
    useGemIncomeForCostEffic: true,
    activeDockId: "lake",
    upgradeLevels,
    enhanceLevels,
    fishCardTier: {},
    sushiCardTier: 0,
    fishingRodCardTier: 0,
    mrNibblesCardTier: 0,
    valuePackPotencyPoly: false,
    skillTreeLevels: {},
    legendaryFishFound: 0,
    abyssLegendaryCaught: false,
    divineRelic5xPoints: 0,
    mcHours: 8,
    mcRuns: 1000,
    sushiMcSushis: 1000,
    mrNibblesLevel: 0,
    mrNibblesQuestUnlocked: false,
    mrNibblesQuestRank: 0,
    mrNibblesSkin: false,
    poseidonIdolLevel: 0,
    tethysIdolLevel: 0,
    astraeusIdolLevel: 0,
    droneBasePowerWorld3Upgrade: 0,
    fishingDroneBasePowerWorld3: 0,
    workshopSushiTicksWorld3: 0,
    legendaryHaulerBundle: false,
    fishersBundle: false,
    anglerBundle: false,
    halfWayBundle: false,
    divineChallengeCoinLevel: 0,
    constructStatue: "none",
    cetusLevel: 0,
    superStarsLevel: 0,
    blackHoleBonus: false,
    infernalMrNibblesPct: 0,
    infernalMrNibblesLevel: 0,
    infernalAnglerDronePct: 0,
    infernalAnglerDroneLevel: 0,
  };
}

/**
 * Load the persisted Fishing state from localStorage, merging with defaults and clamping every field
 * (same logic the Fishing page used in its lazy `useState` initializer).
 */
export function loadFishingState(): FishingState {
  const saved = loadJson<SavedState>(FISHING_STORAGE_KEY);
  const upgradeLevels = saved?.upgradeLevels ?? {};
  const enhanceLevels = saved?.enhanceLevels ?? {};
  const computed = computeFishingStatsFromLevels(upgradeLevels, enhanceLevels);
  const dronesPerDock: Record<DockId, number> = {} as Record<DockId, number>;
  DOCKS.forEach((d, i) => {
    dronesPerDock[d.id] = saved?.dronesPerDock?.[d.id] ?? (i === 0 ? Math.max(0, Math.round(computed.fishing_drone_cap)) : 0);
  });
  const showDisabledFishGrayed = saved?.showDisabledFishGrayed ?? false;
  const showPolyShardDroprate = saved?.showPolyShardDroprate ?? true;
  const useGemIncomeForCostEffic = saved?.useGemIncomeForCostEffic ?? true;
  const activeDockId: DockId = (saved?.activeDockId != null ? saved.activeDockId : "lake") as DockId;
  const fishCardTier = saved?.fishCardTier ?? {};
  const sushiCardTier = clamp(Math.trunc(Number(saved?.sushiCardTier ?? 0)), 0, 3) as FishCardTier;
  const valuePackPotencyPoly = saved?.valuePackPotencyPoly ?? false;
  const skillTreeLevels = saved?.skillTreeLevels ?? {};
  const legendaryFishFound = Math.max(0, Math.floor(Number(saved?.legendaryFishFound ?? 0)));
  const abyssLegendaryCaught = Boolean(saved?.abyssLegendaryCaught ?? false);
  const fishingRodCardTier = clamp(Math.trunc(Number(saved?.fishingRodCardTier ?? 0)), 0, 3) as FishCardTier;
  const mrNibblesCardTier = clamp(Math.trunc(Number(saved?.mrNibblesCardTier ?? 0)), 0, 3) as FishCardTier;
  const divineRelic5xPoints = Math.max(0, Math.trunc(Number(saved?.divineRelic5xPoints ?? 0)));
  const mcHours = clamp(Number(saved?.mcHours ?? 8), 0.1, 720);
  const mcRuns = clamp(Math.trunc(Number(saved?.mcRuns ?? 1000)), 1000, 100000);
  const sushiMcSushis = clamp(
    Math.trunc(Number(saved?.sushiMcSushis ?? 1000)),
    SUSHI_MC_SUSHIS_MIN,
    SUSHI_MC_SUSHIS_MAX,
  );
  const rawMrLvl = Number(saved?.mrNibblesLevel ?? 0);
  const mrNibblesLevel = Number.isFinite(rawMrLvl) ? Math.max(0, Math.trunc(rawMrLvl)) : 0;
  const rawMrQuest = Number(saved?.mrNibblesQuestRank ?? 0);
  const mrNibblesQuestRank = Number.isFinite(rawMrQuest) ? Math.max(0, Math.trunc(rawMrQuest)) : 0;
  const mrNibblesQuestUnlocked = saved?.mrNibblesQuestUnlocked === true || (saved?.mrNibblesQuestUnlocked === undefined && mrNibblesQuestRank > 0);
  const mrNibblesSkin = Boolean(saved?.mrNibblesSkin ?? false);
  const poseidonIdolLevel = Math.max(0, Math.trunc(Number(saved?.poseidonIdolLevel ?? 0)));
  const tethysIdolLevel = Math.max(0, Math.trunc(Number(saved?.tethysIdolLevel ?? 0)));
  const astraeusIdolLevel = Math.max(0, Math.trunc(Number(saved?.astraeusIdolLevel ?? 0)));
  const fishingDroneBasePowerWorld3 = Math.max(0, Math.trunc(Number(saved?.fishingDroneBasePowerWorld3 ?? 0)));
  const workshopSushiTicksWorld3 = Math.max(0, Math.trunc(Number(saved?.workshopSushiTicksWorld3 ?? 0)));
  const legendaryHaulerBundle = Boolean(saved?.legendaryHaulerBundle ?? false);
  const fishersBundle = Boolean(saved?.fishersBundle ?? false);
  const anglerBundle = Boolean(saved?.anglerBundle ?? false);
  const halfWayBundle = Boolean(saved?.halfWayBundle ?? false);
  const divineChallengeCoinLevel = Math.max(0, Math.trunc(Number(saved?.divineChallengeCoinLevel ?? 0)));
  const constructStatueRaw = saved?.constructStatue;
  const constructStatue =
    constructStatueRaw === "gilded" || constructStatueRaw === "platinized" ? constructStatueRaw : "none";
  const cetusLevel = Math.max(0, Math.trunc(Number(saved?.cetusLevel ?? 0)));
  const superStarsLevel = Math.max(0, Math.trunc(Number(saved?.superStarsLevel ?? 0)));
  const blackHoleBonus = Boolean(saved?.blackHoleBonus ?? false);
  const droneBasePowerWorld3Upgrade = Math.max(0, Math.trunc(Number(saved?.droneBasePowerWorld3Upgrade ?? 0)));
  const infernalMrNibblesPct = Math.max(0, Number(saved?.infernalMrNibblesPct ?? 0));
  const infernalMrNibblesLevel = Math.max(0, Math.trunc(Number(saved?.infernalMrNibblesLevel ?? 0)));
  const infernalAnglerDronePct = Math.max(0, Number(saved?.infernalAnglerDronePct ?? 0));
  const infernalAnglerDroneLevel = Math.max(0, Math.trunc(Number(saved?.infernalAnglerDroneLevel ?? 0)));
  return { dronesPerDock, showDisabledFishGrayed, showPolyShardDroprate, useGemIncomeForCostEffic, activeDockId, upgradeLevels, enhanceLevels, fishCardTier, sushiCardTier, fishingRodCardTier, mrNibblesCardTier, valuePackPotencyPoly, skillTreeLevels, legendaryFishFound, abyssLegendaryCaught, divineRelic5xPoints, mcHours, mcRuns, sushiMcSushis, mrNibblesLevel, mrNibblesQuestUnlocked, mrNibblesQuestRank, mrNibblesSkin, poseidonIdolLevel, tethysIdolLevel, astraeusIdolLevel, droneBasePowerWorld3Upgrade, fishingDroneBasePowerWorld3, workshopSushiTicksWorld3, legendaryHaulerBundle, fishersBundle, anglerBundle, halfWayBundle, divineChallengeCoinLevel, constructStatue, cetusLevel, superStarsLevel, blackHoleBonus, infernalMrNibblesPct, infernalMrNibblesLevel, infernalAnglerDronePct, infernalAnglerDroneLevel };
}

/** Persist the whole state (call from an effect on every change). */
export function saveFishingState(state: FishingState): void {
  saveJson(FISHING_STORAGE_KEY, state);
}
