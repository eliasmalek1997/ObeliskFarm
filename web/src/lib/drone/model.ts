/**
 * Pure Drone math moved out of modules/drone/Drone.tsx (fuel duration / fuel gem cost, Elixir 10x Bomb Recharge,
 * Frogger bomb EV, Lootfrogs, Bomb Bear). Formulas and float evaluation order are unchanged; see
 * lib/gems/__tests__/moved.test.ts, which pins them to numbers captured from the original component.
 */
import { calculateGemBombGemsPerHour, type GameParameters } from "../gemev/freebieEv";

export const ELIXIR_BASE_INTERVAL_SEC = 360;
export const ELIXIR_SUIT_SEC_PER_LEVEL = 15;
export const ELIXIR_FUEL_BUFF_BASE_PCT = 60;
export const ELIXIR_FUEL_BUFF_PCT_PER_GRADE = 6;
export const ELIXIR_NUM_BUFFS_WITH_FISHING = 10;
export const ELIXIR_NUM_BUFFS_WITHOUT_FISHING = 9;
/** 10x Bomb Recharge buff base duration (game seconds) in the Elixir rotation. */
export const ELIXIR_10X_BOMB_BASE_SEC = 60;
export const ELIXIR_FUEL_DURATION_BASE_SEC = 210;
export const ELIXIR_FUEL_DURATION_SEC_PER_GRADE = 10.5;
export const FROGGER_FUEL_DURATION_BASE_SEC = 180;
export const FROGGER_FUEL_DURATION_SEC_PER_GRADE = 9;
export const FROGGER_BASE_INTERVAL_SEC = 30;
export const FROGGER_SUIT_SEC_PER_LEVEL = 1.5;
export const FROGGER_FUEL_BOMBS_BASE = 5;
export const FROGGER_FUEL_BOMBS_PER_GRADE = 1;
export const FROGGER_LOOTFROG_CHANCE_PCT_PER_GRADE = 0.003;
export const FROGGER_LOOTFROG_CHANCE_PCT_MAX = 0.135;
export const LOOTFROG_TOTAL_WEIGHT = 196;
export const BOMB_BEAR_LOOTBUG_SPAWN_PCT_BASE = 30;
export const BOMB_BEAR_LOOTBUG_SPAWN_PCT_PER_GRADE = 3;
export const BOMB_BEAR_FUEL_DURATION_BASE_SEC = 240;
export const BOMB_BEAR_FUEL_DURATION_SEC_PER_GRADE = 12;
export const ANGLER_FUEL_DURATION_BASE_SEC = 180;
export const ANGLER_FUEL_DURATION_SEC_PER_GRADE = 9;
export const STARBURST_FUEL_DURATION_BASE_SEC = 140;
export const STARBURST_FUEL_DURATION_SEC_PER_GRADE = 9;
export const VOID_FUEL_DURATION_BASE_SEC = 180;
export const VOID_FUEL_DURATION_SEC_PER_GRADE = 9;
export const VEINSEEKER_FUEL_DURATION_BASE_SEC = 180;
export const VEINSEEKER_FUEL_DURATION_SEC_PER_GRADE = 9;
export const CHAIN_BOMBER_FUEL_DURATION_BASE_SEC = 180;
export const CHAIN_BOMBER_FUEL_DURATION_SEC_PER_GRADE = 9;
export const GASOLINE_GUZZLER_FUEL_DURATION_PCT = 20;
/** 1 fuel = 5 gems (in-game cost). */
export const GEMS_PER_FUEL = 5;

/** Misc Fuel card tier: 0 = none (1x), 1 = Card (1.02x), 2 = Gilded (1.05x), 3 = Polychrome (1.10x). */
export type MiscFuelCardTier = 0 | 1 | 2 | 3;
export const MISC_FUEL_MULT: Record<MiscFuelCardTier, number> = { 0: 1, 1: 1.02, 2: 1.05, 3: 1.1 };

export type LootfrogRewardGroup =
  | "gems"
  | "fuel"
  | "relicChests"
  | "lantern"
  | "tier2Items"
  | "skillPoints"
  | "sushi"
  | "blueCow"
  | "frogspawn";

/** Lootfrog rewards: label, weight (chance), gem EV (null = not calculable), icon (wiki filename), display group. 1 skill point = 125 gems. */
export const LOOTFROG_REWARDS: Array<{ label: string; weight: number; gemEv: number | null; iconFile: string | null; group: LootfrogRewardGroup }> = [
  { label: "50–100 Gems", weight: 70, gemEv: 75, iconFile: "Gem.png", group: "gems" },
  { label: "15–30 Fuel", weight: 40, gemEv: 112.5, iconFile: "Fuel.png", group: "fuel" }, // 22.5 fuel × 5
  { label: "10–20 Relic Chests", weight: 50, gemEv: null, iconFile: "Relic_Chest.png", group: "relicChests" },
  { label: "1 Lootbug Lantern", weight: 1, gemEv: null, iconFile: "Lootbug_Lantern.png", group: "lantern" },
  { label: "4–8 Tier 2 Items", weight: 8, gemEv: null, iconFile: "Items_Button.png", group: "tier2Items" },
  { label: "1–3 Skill Points", weight: 2, gemEv: 250, iconFile: "Skill_Point.png", group: "skillPoints" }, // 2 sp × 125
  { label: "3–5 Sushi", weight: 8, gemEv: null, iconFile: "Sushi.png", group: "sushi" },
  { label: "4–10 Blue Cow", weight: 6, gemEv: null, iconFile: "Blue_Cow.png", group: "blueCow" },
  { label: "1 Frogspawn", weight: 1, gemEv: null, iconFile: "Frogspawn.png", group: "frogspawn" },
  { label: "150–300 Gems", weight: 4, gemEv: 225, iconFile: "Gem.png", group: "gems" },
  { label: "100–150 Relic Chests", weight: 2, gemEv: null, iconFile: "Relic_Chest.png", group: "relicChests" },
  { label: "1000–3000 Gems", weight: 2, gemEv: 2000, iconFile: "Gem.png", group: "gems" },
  { label: "15–30 Sushi", weight: 2, gemEv: null, iconFile: "Sushi.png", group: "sushi" },
];

export type ElixirState = {
  gameSpeedMultiplier: number;
  /** Elixir Drone enabled (ON). When OFF, contributions to Gem EV/fuel are zero. */
  elixirDroneOn: boolean;
  elixirSuitLevel: number;
  elixirGradeLevel: number;
  fishingUnlocked: boolean;
  fueled: boolean;
  gasolineGuzzler: boolean;
  fuelDurationUpgradeLevel: number;
  fuelSaveChanceUpgradeLevel: number;
  /** Upgrade Fuel Save Chance (%), multiplicative with Coal Fuel Save. Decimal allowed. */
  upgradeFuelSaveChancePct: number;
  miscFuelCardTier: MiscFuelCardTier;
  /** Relic: Fuel Duration +0.01% per level (multiplicative). */
  fuelDurationRelicLevel: number;
  /** Axolotl Skin: +10% fuel duration (multiplicative). */
  axolotlSkin: boolean;
  /** Platinum Statue of Appetite (Pet): +15% fuel duration (multiplicative). */
  platinumStatueOfAppetite: boolean;
  /** World 3 upgrade: Fuel Duration +0.15% per level (multiplicative). */
  fuelDurationWorld3Level: number;
  elixirCritChanceFishing: boolean;
  infernalElixirDroneCard: boolean;
  elixirCritMult: number;
  froggerDroneOn: boolean;
  froggerSuitLevel: number;
  froggerGradeLevel: number;
  froggerFueled: boolean;
  lootfrogsUnlocked: boolean;
  lootfrogLootMultiplier: number;
  tripleLootfrogChancePct: number;
  lootfrog10xChancePct: number;
  lootfrogCapacity: number;
  goldenLootfrogChancePct: number;
  goldenLootfrogMultiplier: number;
  bigLootfrogChancePct: number;
  bigLootfrogMultiplier: number;
  bombBearDroneOn: boolean;
  bombBearGradeLevel: number;
  bombBearFueled: boolean;
  anglerDroneOn: boolean;
  anglerSuitLevel: number;
  anglerGradeLevel: number;
  anglerFueled: boolean;
  starburstDroneOn: boolean;
  starburstSuitLevel: number;
  starburstGradeLevel: number;
  starburstFueled: boolean;
  chainBomberDroneOn: boolean;
  chainBomberGradeLevel: number;
  chainBomberFueled: boolean;
  voidDroneOn: boolean;
  voidGradeLevel: number;
  voidFueled: boolean;
  veinseekerDroneOn: boolean;
  veinseekerGradeLevel: number;
  veinseekerFueled: boolean;
};

export const DEFAULT_DRONE_STATE: ElixirState = {
  gameSpeedMultiplier: 1,
  elixirDroneOn: false,
  elixirSuitLevel: 8,
  elixirGradeLevel: 0,
  fishingUnlocked: true,
  fueled: false,
  gasolineGuzzler: true,
  fuelDurationUpgradeLevel: 19,
  fuelSaveChanceUpgradeLevel: 0,
  upgradeFuelSaveChancePct: 0,
  miscFuelCardTier: 0,
  fuelDurationRelicLevel: 0,
  axolotlSkin: false,
  platinumStatueOfAppetite: false,
  fuelDurationWorld3Level: 0,
  elixirCritChanceFishing: false,
  infernalElixirDroneCard: false,
  elixirCritMult: 3,
  froggerDroneOn: false,
  froggerSuitLevel: 8,
  froggerGradeLevel: 0,
  froggerFueled: false,
  lootfrogsUnlocked: false,
  lootfrogLootMultiplier: 1,
  tripleLootfrogChancePct: 0,
  lootfrog10xChancePct: 0,
  lootfrogCapacity: 5,
  goldenLootfrogChancePct: 0,
  goldenLootfrogMultiplier: 2,
  bigLootfrogChancePct: 0,
  bigLootfrogMultiplier: 5,
  bombBearDroneOn: false,
  bombBearGradeLevel: 0,
  bombBearFueled: false,
  anglerDroneOn: false,
  anglerSuitLevel: 0,
  anglerGradeLevel: 0,
  anglerFueled: false,
  starburstDroneOn: false,
  starburstSuitLevel: 0,
  starburstGradeLevel: 0,
  starburstFueled: false,
  chainBomberDroneOn: false,
  chainBomberGradeLevel: 0,
  chainBomberFueled: false,
  voidDroneOn: false,
  voidGradeLevel: 0,
  voidFueled: false,
  veinseekerDroneOn: false,
  veinseekerGradeLevel: 0,
  veinseekerFueled: false,
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export type DroneId = "elixir" | "frogger" | "bear" | "angler" | "starburst" | "chain" | "void" | "veinseeker";

export type DroneDef = {
  id: DroneId;
  label: string;
  on: keyof ElixirState;
  fueled: keyof ElixirState;
  grade: keyof ElixirState;
  fuelBaseSec: number;
  fuelSecPerGrade: number;
  /** Gem-relevant: its benefit is converted to gems by the gem model (fuel counts as a gem cost). Others: fuel is a non-gem cost. */
  gemRelevant: boolean;
  /** Old Drone.tsx omitted the Gasoline Guzzler multiplier for Veinseeker (kept for the classic module). */
  skipGuzzler?: boolean;
};

export const DRONE_DEFS: DroneDef[] = [
  { id: "elixir", label: "Elixir", on: "elixirDroneOn", fueled: "fueled", grade: "elixirGradeLevel", fuelBaseSec: ELIXIR_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: ELIXIR_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: true },
  { id: "frogger", label: "Frogger", on: "froggerDroneOn", fueled: "froggerFueled", grade: "froggerGradeLevel", fuelBaseSec: FROGGER_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: FROGGER_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: true },
  { id: "bear", label: "Bomb Bear", on: "bombBearDroneOn", fueled: "bombBearFueled", grade: "bombBearGradeLevel", fuelBaseSec: BOMB_BEAR_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: BOMB_BEAR_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: true },
  { id: "angler", label: "Angler", on: "anglerDroneOn", fueled: "anglerFueled", grade: "anglerGradeLevel", fuelBaseSec: ANGLER_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: ANGLER_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: false },
  { id: "starburst", label: "Starburst", on: "starburstDroneOn", fueled: "starburstFueled", grade: "starburstGradeLevel", fuelBaseSec: STARBURST_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: STARBURST_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: false },
  { id: "chain", label: "Chain Bomber", on: "chainBomberDroneOn", fueled: "chainBomberFueled", grade: "chainBomberGradeLevel", fuelBaseSec: CHAIN_BOMBER_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: CHAIN_BOMBER_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: false },
  { id: "void", label: "Void", on: "voidDroneOn", fueled: "voidFueled", grade: "voidGradeLevel", fuelBaseSec: VOID_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: VOID_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: false },
  { id: "veinseeker", label: "Veinseeker", on: "veinseekerDroneOn", fueled: "veinseekerFueled", grade: "veinseekerGradeLevel", fuelBaseSec: VEINSEEKER_FUEL_DURATION_BASE_SEC, fuelSecPerGrade: VEINSEEKER_FUEL_DURATION_SEC_PER_GRADE, gemRelevant: false, skipGuzzler: true },
];

export function droneDef(id: DroneId): DroneDef {
  return DRONE_DEFS.find((d) => d.id === id)!;
}

/**
 * Fuel duration in game seconds for a base-from-grade duration: coal, World 3, Gasoline Guzzler, Axolotl, Platinum Statue,
 * Misc card and Relic are multiplicative; rounded once at the end. (Evaluation order is the original one.)
 */
export function fuelDurationGameSec(fromGradeSec: number, s: ElixirState, opts?: { skipGuzzler?: boolean }): number {
  const world3 = 1 + (s.fuelDurationWorld3Level * 0.15) / 100;
  const relic = 1 + (s.fuelDurationRelicLevel * 0.01) / 100;
  const platinum = s.platinumStatueOfAppetite ? 1.15 : 1;
  const guzzler = opts?.skipGuzzler ? 1 : s.gasolineGuzzler ? 1 + GASOLINE_GUZZLER_FUEL_DURATION_PCT / 100 : 1;
  return Math.round(
    fromGradeSec *
      (1 + s.fuelDurationUpgradeLevel / 100) *
      world3 *
      guzzler *
      (s.axolotlSkin ? 1.1 : 1) *
      platinum *
      MISC_FUEL_MULT[s.miscFuelCardTier] *
      relic,
  );
}

/** Combined fuel-duration multiplier (display only in the classic module). */
export function fuelDurationMultiplier(s: ElixirState): number {
  const world3 = 1 + (s.fuelDurationWorld3Level * 0.15) / 100;
  const relic = 1 + (s.fuelDurationRelicLevel * 0.01) / 100;
  const platinum = s.platinumStatueOfAppetite ? 1.15 : 1;
  return (
    (1 + s.fuelDurationUpgradeLevel / 100) *
    world3 *
    (s.gasolineGuzzler ? 1 + GASOLINE_GUZZLER_FUEL_DURATION_PCT / 100 : 1) *
    (s.axolotlSkin ? 1.1 : 1) *
    platinum *
    MISC_FUEL_MULT[s.miscFuelCardTier] *
    relic
  );
}

/** Real-time fuel duration (seconds) of one drone. */
export function droneFuelDurationSecReal(id: DroneId, s: ElixirState, gameSpeedMult: number): number {
  const d = droneDef(id);
  const grade = s[d.grade] as number;
  return fuelDurationGameSec(d.fuelBaseSec + grade * d.fuelSecPerGrade, s, { skipGuzzler: d.skipGuzzler }) / gameSpeedMult;
}

/** Gems/h spent on fuel for 100% fueled uptime: fuels/h x (1 - save chance) x 5 gems. Save = coal and upgrade save chances combined. */
export function fuelGemsPerHourForDuration(durationSecReal: number, s: ElixirState): number {
  if (durationSecReal <= 0) return 0;
  const fuelsPerHour = 3600 / durationSecReal;
  const coal = s.fuelSaveChanceUpgradeLevel / 100;
  const upgrade = s.upgradeFuelSaveChancePct / 100;
  const saveChance = 1 - (1 - coal) * (1 - upgrade);
  return fuelsPerHour * (1 - saveChance) * GEMS_PER_FUEL;
}

/** Fuel cost per hour of a drone: 0 unless it is ON and fueled (as written to gemev_external by the Drone module). */
export function droneFuelCostGemsPerHour(id: DroneId, s: ElixirState, gameSpeedMult: number): number {
  const d = droneDef(id);
  if (!s[d.on] || !s[d.fueled]) return 0;
  return fuelGemsPerHourForDuration(droneFuelDurationSecReal(id, s, gameSpeedMult), s);
}

/** Bomb Bear Lootbug spawn rate multiplier when ON and fueled (uncapped). */
export function bombBearSpawnRateMult(s: ElixirState): number {
  if (!s.bombBearDroneOn || !s.bombBearFueled) return 1;
  const pct = BOMB_BEAR_LOOTBUG_SPAWN_PCT_BASE + s.bombBearGradeLevel * BOMB_BEAR_LOOTBUG_SPAWN_PCT_PER_GRADE;
  return 1 + pct / 100;
}

/** Elixir drone: real minutes per hour of 10x Bomb Recharge (before the ON gate). */
export function elixirBomb10xMinPerHour(s: ElixirState, gameSpeedMult: number): number {
  const suitLevel = clamp(Math.round(s.elixirSuitLevel), 0, 20);
  const intervalSecBase = Math.max(1, ELIXIR_BASE_INTERVAL_SEC - suitLevel * ELIXIR_SUIT_SEC_PER_LEVEL);
  const intervalSec = intervalSecBase / gameSpeedMult;
  const numBuffs = s.fishingUnlocked ? ELIXIR_NUM_BUFFS_WITH_FISHING : ELIXIR_NUM_BUFFS_WITHOUT_FISHING;
  const fueledBuffDurationPct = ELIXIR_FUEL_BUFF_BASE_PCT + s.elixirGradeLevel * ELIXIR_FUEL_BUFF_PCT_PER_GRADE;
  const fuelMult = s.fueled ? 1 + fueledBuffDurationPct / 100 : 1;
  const elixirCritExpectedMult = s.elixirCritChanceFishing ? 1 + 0.1 * (s.elixirCritMult - 1) : 1;
  const cycleSec = numBuffs * intervalSec;
  if (cycleSec <= 0) return 0;
  const baseSec = (ELIXIR_10X_BOMB_BASE_SEC * fuelMult) / gameSpeedMult;
  const sec = baseSec * elixirCritExpectedMult;
  return Math.min(60, (sec / cycleSec) * 60);
}

/** Frogger autofire schedule: real interval (s) and bombs per autofire (fueled: 5 + grade, else 1). */
export function froggerSchedule(s: ElixirState, gameSpeedMult: number): { intervalSecReal: number; bombsPerAutofire: number } {
  const intervalSecGame = Math.max(0.1, FROGGER_BASE_INTERVAL_SEC - s.froggerSuitLevel * FROGGER_SUIT_SEC_PER_LEVEL);
  return {
    intervalSecReal: intervalSecGame / gameSpeedMult,
    bombsPerAutofire: s.froggerFueled ? FROGGER_FUEL_BOMBS_BASE + s.froggerGradeLevel * FROGGER_FUEL_BOMBS_PER_GRADE : 1,
  };
}

export type FroggerBombEv = {
  gemEvPerHour: number;
  totalBombTypes: number;
  bombsPerTypePerHour: number;
  deltaGem: number;
  deltaCherry: number;
  deltaBattery: number;
  deltaD20: number;
};

/**
 * Frogger Gem EV/h. `params` must already carry bomb params, total_bomb_types, 10x min/h and Chaos uptime.
 * Uniform random bomb pick: bombs per type per hour is equal; value = marginal gem EV of one extra click on each of the 4 gem-relevant bombs.
 */
export function froggerBombEv(params: GameParameters, intervalSecReal: number, bombsPerAutofire: number): FroggerBombEv {
  const totalBombTypes = Math.max(2, Math.min(13, params.total_bomb_types));
  const baseEv = calculateGemBombGemsPerHour(params, 0);
  const deltaGem = calculateGemBombGemsPerHour(params, { gem: 1 }) - baseEv;
  const deltaCherry = calculateGemBombGemsPerHour(params, { cherry: 1 }) - baseEv;
  const deltaBattery = calculateGemBombGemsPerHour(params, { battery: 1 }) - baseEv;
  const deltaD20 = calculateGemBombGemsPerHour(params, { d20: 1 }) - baseEv;
  const sumDeltas = deltaGem + deltaCherry + deltaBattery + deltaD20;
  const bombsPerHour = 3600 / Math.max(0.1, intervalSecReal);
  const bombsPerPick = bombsPerAutofire;
  const gemEvPerHour = bombsPerHour * (1 / totalBombTypes) * bombsPerPick * sumDeltas;
  const bombsPerTypePerHour = (bombsPerHour * bombsPerPick) / totalBombTypes;
  return { gemEvPerHour, totalBombTypes, bombsPerTypePerHour, deltaGem, deltaCherry, deltaBattery, deltaD20 };
}

export type LootfrogRow = (typeof LOOTFROG_REWARDS)[number] & { spawnsPerHour: number; gemsPerHour: number | null };

/** Lootfrog gains (needs lootfrogsUnlocked and Frogger ON). Frogspawn = capacity lootfrogs with recursive EV. */
export function lootfrogStats(
  s: ElixirState,
  froggerIntervalSecReal: number,
): { lootfrogsPerHour: number; valuePerFrogspawn: number; rows: LootfrogRow[]; gemsPerHour: number } {
  if (!s.lootfrogsUnlocked || !s.froggerDroneOn) return { lootfrogsPerHour: 0, valuePerFrogspawn: 0, rows: [], gemsPerHour: 0 };
  const autofiresPerHour = 3600 / Math.max(0.1, froggerIntervalSecReal);
  const spawnChancePct = Math.min(s.froggerGradeLevel * FROGGER_LOOTFROG_CHANCE_PCT_PER_GRADE, FROGGER_LOOTFROG_CHANCE_PCT_MAX);
  const triggersPerHour = autofiresPerHour * (spawnChancePct / 100);
  const triplePct = s.tripleLootfrogChancePct / 100;
  const tenXPct = s.lootfrog10xChancePct / 100;
  const expectedPerTrigger = 1 + 2 * triplePct + 9 * tenXPct;
  const lootfrogsPerHour = triggersPerHour * expectedPerTrigger;
  const lootMult = s.lootfrogLootMultiplier;
  const goldenPct = s.goldenLootfrogChancePct / 100;
  const goldenMult = 1 - goldenPct + goldenPct * s.goldenLootfrogMultiplier;
  const bigPct = s.bigLootfrogChancePct / 100;
  const bigMult = 1 - bigPct + bigPct * s.bigLootfrogMultiplier;
  const rewardMult = lootMult * goldenMult * bigMult;
  const baseEvPerLootfrog =
    (1 / LOOTFROG_TOTAL_WEIGHT) * LOOTFROG_REWARDS.reduce((sum, r) => sum + (r.gemEv != null ? r.weight * r.gemEv : 0), 0);
  const cap = Math.min(s.lootfrogCapacity, LOOTFROG_TOTAL_WEIGHT - 1);
  const evPerLootfrogRecursive = (baseEvPerLootfrog * LOOTFROG_TOTAL_WEIGHT) / (LOOTFROG_TOTAL_WEIGHT - cap);
  const valuePerFrogspawn = cap * evPerLootfrogRecursive * rewardMult;
  const rows: LootfrogRow[] = LOOTFROG_REWARDS.map((r) => {
    const spawnsPerHour = lootfrogsPerHour * (r.weight / LOOTFROG_TOTAL_WEIGHT);
    const effectiveEv = r.label === "1 Frogspawn" ? valuePerFrogspawn : r.gemEv;
    const gemsPerHour = effectiveEv != null ? spawnsPerHour * effectiveEv : null;
    return { ...r, spawnsPerHour, gemsPerHour };
  });
  return { lootfrogsPerHour, valuePerFrogspawn, rows, gemsPerHour: rows.reduce((sum, r) => sum + (r.gemsPerHour ?? 0), 0) };
}
