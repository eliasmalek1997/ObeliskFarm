/**
 * Test fixtures: the "analysis player" (Obelisk lvl 49, boat 3) reconstructed from an in-game export,
 * plus a default and a late-game (T2) state used for characterization tests.
 */
import { ALL_FISH, ENHANCEMENTS_T1, ENHANCEMENTS_T2, FISHING_UPGRADES_T1, FISHING_UPGRADES_T2, DOCKS } from "../constants";

const U_ORDER = [...FISHING_UPGRADES_T1, ...FISHING_UPGRADES_T2].map((d) => d.id);
const E_ORDER = [...ENHANCEMENTS_T1, ...ENHANCEMENTS_T2].map((d) => d.id);

function zip<T extends string>(ids: T[], arr: number[]): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  ids.forEach((id, i) => {
    out[id] = arr[i] ?? 0;
  });
  return out;
}

export const PLAYER_UPGRADES = zip(U_ORDER, [19, 20, 3, 13, 15, 12, 7, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
export const PLAYER_ENHANCES = zip(E_ORDER, [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const cardArr = [1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 0, 1];
export const PLAYER_CARDS: Record<string, 0 | 1 | 2 | 3> = {};
ALL_FISH.forEach((f, i) => {
  PLAYER_CARDS[f.id] = (cardArr[i] ?? 0) as 0 | 1 | 2 | 3;
});

/** Skill/store/etc. options exactly as the analysis (an.ts) used them. */
export const PLAYER_OPTS = {
  skillTreeLevels: { fishing_with_friends: 1 },
  fishCardTier: PLAYER_CARDS,
  halfWayBundle: true,
  superStarsLevel: 4,
};

export function allDronesOn(dockId: string, n: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DOCKS) out[d.id] = d.id === dockId ? n : 0;
  return out;
}

/** Late game: boat 5, T2 boat 3, lots of everything. */
export const LATE_UPGRADES = zip(U_ORDER, [60, 50, 5, 40, 30, 20, 20, 30, 30, 25, 30, 25, 3, 10, 12, 8, 5, 4]);
export const LATE_ENHANCES = zip(E_ORDER, [120, 25, 20, 20, 25, 5, 20, 5, 10, 20, 10, 20, 8, 10, 6]);
export const LATE_OPTS = {
  skillTreeLevels: { fishing_with_friends: 3, motley_school: 2, pick_up_the_pace: 3, completionist_gatekeeper: 2 },
  fishCardTier: Object.fromEntries(ALL_FISH.map((f, i) => [f.id, (i % 4) as 0 | 1 | 2 | 3])),
  legendaryFishFound: 6,
  abyssLegendaryCaught: true,
  fishingRodCardTier: 2 as const,
  valuePackPotencyPoly: true,
  legendaryHaulerBundle: true,
  fishersBundle: true,
  halfWayBundle: true,
  constructStatue: "gilded" as const,
  cetusLevel: 3,
  superStarsLevel: 5,
  blackHoleBonus: true,
  mrNibblesLevel: 4,
  mrNibblesQuestUnlocked: true,
  mrNibblesQuestRank: 1,
  poseidonIdolLevel: 5,
  tethysIdolLevel: 100,
  astraeusIdolLevel: 50,
  relic5xPoints: 3,
};

// ——— full FishingState builders ———
import { getDefaultFishingState, type FishingState } from "../state";

/** The analysis player as a full state; rod + 43 drones on Tundra (where the next rod upgrade's frostshell crabs live). */
export function playerState(over: Partial<FishingState> = {}): FishingState {
  return {
    ...getDefaultFishingState(),
    upgradeLevels: { ...PLAYER_UPGRADES },
    enhanceLevels: { ...PLAYER_ENHANCES },
    fishCardTier: { ...PLAYER_CARDS },
    skillTreeLevels: { fishing_with_friends: 1 },
    halfWayBundle: true,
    superStarsLevel: 4,
    dronesPerDock: allDronesOn("tundra", 43) as FishingState["dronesPerDock"],
    activeDockId: "tundra",
    ...over,
  };
}

export function lateState(over: Partial<FishingState> = {}): FishingState {
  const o = LATE_OPTS;
  return {
    ...getDefaultFishingState(),
    upgradeLevels: { ...LATE_UPGRADES },
    enhanceLevels: { ...LATE_ENHANCES },
    fishCardTier: { ...o.fishCardTier },
    skillTreeLevels: { ...o.skillTreeLevels },
    legendaryFishFound: o.legendaryFishFound,
    abyssLegendaryCaught: o.abyssLegendaryCaught,
    fishingRodCardTier: o.fishingRodCardTier,
    valuePackPotencyPoly: o.valuePackPotencyPoly,
    legendaryHaulerBundle: o.legendaryHaulerBundle,
    fishersBundle: o.fishersBundle,
    halfWayBundle: o.halfWayBundle,
    constructStatue: o.constructStatue,
    cetusLevel: o.cetusLevel,
    superStarsLevel: o.superStarsLevel,
    blackHoleBonus: o.blackHoleBonus,
    mrNibblesLevel: o.mrNibblesLevel,
    mrNibblesQuestUnlocked: o.mrNibblesQuestUnlocked,
    mrNibblesQuestRank: o.mrNibblesQuestRank,
    poseidonIdolLevel: o.poseidonIdolLevel,
    tethysIdolLevel: o.tethysIdolLevel,
    astraeusIdolLevel: o.astraeusIdolLevel,
    divineRelic5xPoints: o.relic5xPoints,
    dronesPerDock: allDronesOn("galaxy", 120) as FishingState["dronesPerDock"],
    activeDockId: "galaxy",
    ...over,
  };
}
