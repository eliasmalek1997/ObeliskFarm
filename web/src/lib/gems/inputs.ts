/**
 * Gem model inputs, read from the modules' localStorage saves (no dependence on gemev_external.json).
 *
 * Merge rule for the duplicated GameParameters (GemEv and Bombs both persist a full object):
 *  - freebie / stonks / shards / VIP / founder / game speed / obelisk / W3 fields: GemEv save (defaults for missing).
 *  - bomb fields (BOMB_PARAM_KEYS): Bombs save when it exists and defines the key, else GemEv save (the importer writes
 *    free_bomb_chance / cherry 3x to both), else defaults.
 * Everything else the model needs (lootbug state, drone state, items) is read from its own save and clamped like the module does.
 */
import { loadJson, saveJson } from "../storage";
import { defaultGameParameters, type GameParameters } from "../gemev/freebieEv";
import { DEFAULT_ITEMS_INPUTS, type ItemsInputs } from "../items/model";
import { DEFAULT_ACTIVE_GEM_BUFFS, DEFAULT_LOOTBUG_STATE, type LootbugState } from "../lootbug/model";
import { GEM_BUFFS } from "../lootbug/constants";
import { DEFAULT_DRONE_STATE, type DroneId, type ElixirState, type MiscFuelCardTier } from "../drone/model";

const P = "obeliskfarm:web:";
export const GEMEV_SAVE_KEY = `${P}gemev_save.json:v1`;
export const BOMBS_SAVE_KEY = `${P}bombs_save.json:v1`;
export const LOOTBUG_SAVE_KEY = `${P}lootbug_save.json:v1`;
export const DRONE_SAVE_KEY = `${P}drone_elixir_save.json:v9`;
export const DRONE_LEGACY_KEYS = [8, 7, 6, 5, 4, 3, 2, 1].map((v) => `${P}drone_elixir_save.json:v${v}`);
export const ITEMS_SAVE_KEY = `${P}items_save.json:v1`;
export const OVERNIGHT_SAVE_KEY = `${P}overnight_save.json:v1`;
export const GEMS_PAGE_KEY = `${P}gems_page.json`;

/** Fields of GameParameters that Bombs owns. */
export const BOMB_PARAM_KEYS = [
  "free_bomb_chance",
  "include_founder_bomb_in_total",
  "has_veinmorph_bomb",
  "has_megabomb",
  "bomb_cycle",
  "gem_bomb_recharge_card_level",
  "cherry_bomb_recharge_card_level",
  "battery_bomb_recharge_card_level",
  "d20_bomb_recharge_card_level",
  "founder_bomb_recharge_card_level",
  "gem_bomb_recharge_seconds",
  "gem_bomb_gem_chance",
  "has_golden_gem_bomb",
  "cherry_bomb_recharge_seconds",
  "cherry_bomb_triple_charge_chance",
  "battery_bomb_recharge_seconds",
  "d20_bomb_recharge_seconds",
  "d20_bomb_refill_chance",
  "d20_bomb_charges_distributed",
] as const satisfies readonly (keyof GameParameters)[];

export type OvernightInputs = { sleepHours: number; gemBombActive: boolean; offlineNoElixirBuff: boolean };

export type GemInputs = {
  /** Merged RAW params (see module doc). The model normalises them (derived bomb type count, clamps, stonks toggle). */
  params: GameParameters;
  stonksEnabled: boolean;
  skillShardsEnabled: boolean;
  statueSopranoLevel: number;
  /** Banked freebies cap (GemEv "bankedFreebies", importer: freebie_bank_cap). */
  bankedFreebies: number;
  /** Bombs "Chaos Totem 100% uptime": recharge seconds are in-game values (already /2). */
  chaosTotem100Uptime: boolean;
  lootbug: LootbugState;
  drone: ElixirState;
  items: ItemsInputs;
  overnight: OvernightInputs;
  /** Which saves were found (false = defaults used). */
  present: { gemev: boolean; bombs: boolean; lootbug: boolean; drone: boolean; items: boolean; overnight: boolean };
};

/** Page-local settings (what-ifs). All optional; undefined/null = use the saved module value. */
export type GemOverrides = {
  /** Gems per freebie roll (replaces GemEv freebie_gems_base). */
  gemsPerFreebieRoll?: number | null;
  bombCycle?: "early" | "late" | null;
  /** Lootbug gem buffs the player buys (names from lib/lootbug/constants GEM_BUFFS). null = lootbug save. */
  lootbugBuy?: string[] | null;
  /** What-if fuel toggle per drone. */
  droneFuel?: Partial<Record<DroneId, boolean>>;
  /** What-if equipped toggle per drone. */
  droneOn?: Partial<Record<DroneId, boolean>>;
  /** Chaos Totem at 100% uptime (only meaningful when Bombs recharge seconds are base values). */
  chaosTotemFull?: boolean;
  /** Gem price the player entered per lever id (used for payback). */
  prices?: Record<string, number>;
};

export const DEFAULT_GEM_OVERRIDES: GemOverrides = {};

export function loadGemOverrides(): GemOverrides {
  const s = loadJson<GemOverrides>(GEMS_PAGE_KEY);
  return s && typeof s === "object" ? { ...DEFAULT_GEM_OVERRIDES, ...s } : { ...DEFAULT_GEM_OVERRIDES };
}
export function saveGemOverrides(o: GemOverrides): void {
  saveJson(GEMS_PAGE_KEY, o);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** Merge GemEv + Bombs saved params (see module doc). */
export function mergeGemParams(gemev?: Partial<GameParameters> | null, bombs?: Partial<GameParameters> | null): GameParameters {
  const p: GameParameters = { ...defaultGameParameters(), ...(gemev ?? {}) } as GameParameters;
  if (bombs) {
    const target = p as unknown as Record<string, unknown>;
    const src = bombs as unknown as Record<string, unknown>;
    for (const k of BOMB_PARAM_KEYS) if (src[k] !== undefined) target[k] = src[k];
  }
  return p;
}

function loadLootbug(): { state: LootbugState; present: boolean } {
  const saved = loadJson<Partial<LootbugState>>(LOOTBUG_SAVE_KEY);
  const s = { ...DEFAULT_LOOTBUG_STATE, ...(saved ?? {}) } as LootbugState;
  s.spawnRateMultiplier = clamp(s.spawnRateMultiplier, 0.1, 20);
  s.tripleChancePct = clamp(s.tripleChancePct, 0, 100);
  s.goldenChancePct = clamp(s.goldenChancePct, 0, 100);
  s.gemCostReduction = clampInt(s.gemCostReduction, 0, 999);
  s.lootMultiplier = clamp(s.lootMultiplier, 0.1, 5);
  s.bankCap = clampInt(s.bankCap ?? 10, 1, 999);
  const valid = new Set(GEM_BUFFS.map((b) => b.name));
  s.activeGemBuffs = Array.isArray(s.activeGemBuffs) ? s.activeGemBuffs.filter((n) => valid.has(n)) : [...DEFAULT_ACTIVE_GEM_BUFFS];
  if (s.activeGemBuffs.length === 0) s.activeGemBuffs = [...DEFAULT_ACTIVE_GEM_BUFFS];
  return { state: s, present: saved != null };
}

function loadDrone(): { state: ElixirState; present: boolean } {
  let saved: Record<string, unknown> | null = null;
  for (const k of [DRONE_SAVE_KEY, ...DRONE_LEGACY_KEYS]) {
    saved = loadJson<Record<string, unknown>>(k);
    if (saved) break;
  }
  const s = { ...DEFAULT_DRONE_STATE, ...(saved ?? {}) } as ElixirState;
  s.gameSpeedMultiplier = clamp(s.gameSpeedMultiplier, 1, 10);
  s.fuelDurationUpgradeLevel = clamp(s.fuelDurationUpgradeLevel, 0, 9999);
  s.fuelSaveChanceUpgradeLevel = clamp(s.fuelSaveChanceUpgradeLevel, 0, 9999);
  s.upgradeFuelSaveChancePct = clamp(s.upgradeFuelSaveChancePct ?? 0, 0, 100);
  s.miscFuelCardTier = clamp(Math.round(Number(s.miscFuelCardTier ?? 0)), 0, 3) as MiscFuelCardTier;
  s.fuelDurationRelicLevel = Math.max(0, Math.trunc(Number(s.fuelDurationRelicLevel ?? 0)));
  s.fuelDurationWorld3Level = clamp(Number(s.fuelDurationWorld3Level ?? 0), 0, 9999);
  s.elixirCritMult = clamp(Number(s.elixirCritMult ?? 3), 1, 20);
  s.elixirSuitLevel = clamp(s.elixirSuitLevel, 0, 20);
  s.froggerSuitLevel = clamp(s.froggerSuitLevel, 0, 20);
  s.anglerSuitLevel = clamp(s.anglerSuitLevel, 0, 20);
  s.starburstSuitLevel = clamp(s.starburstSuitLevel, 0, 20);
  return { state: s, present: saved != null };
}

/** Read every input of the gem model from localStorage. Never throws; missing saves fall back to module defaults. */
export function readGemInputs(): GemInputs {
  const gemev = loadJson<{
    params?: Partial<GameParameters>;
    stonks_enabled?: boolean;
    skill_shards_enabled?: boolean;
    statue_soprano_level?: number;
    bankedFreebies?: number;
  }>(GEMEV_SAVE_KEY);
  const bombs = loadJson<{ params?: Partial<GameParameters>; chaosTotem100Uptime?: boolean }>(BOMBS_SAVE_KEY);
  const items = loadJson<Partial<ItemsInputs> & { chaosTotemDuration?: string }>(ITEMS_SAVE_KEY);
  const overnight = loadJson<Partial<OvernightInputs>>(OVERNIGHT_SAVE_KEY);
  const lb = loadLootbug();
  const dr = loadDrone();

  const params = mergeGemParams(gemev?.params, bombs?.params);
  // Legacy: game_speed_pct (0..12) before game_speed_multiplier existed.
  const gsPct = (params as { game_speed_pct?: number }).game_speed_pct;
  if (params.game_speed_multiplier === 1 && typeof gsPct === "number" && gsPct > 0) params.game_speed_multiplier = 1 + clampInt(gsPct, 0, 12) / 100;

  const itemsIn: ItemsInputs = { ...DEFAULT_ITEMS_INPUTS };
  if (items) {
    if (typeof items.itemsPerChest === "number") itemsIn.itemsPerChest = Math.max(0, items.itemsPerChest);
    if (typeof items.chaosTotemObtainChance === "number") itemsIn.chaosTotemObtainChance = Math.max(0, items.chaosTotemObtainChance);
    if (typeof items.chaosTotemDurationMin === "number" && typeof items.chaosTotemDurationSec === "number") {
      itemsIn.chaosTotemDurationMin = Math.max(0, Math.trunc(items.chaosTotemDurationMin));
      itemsIn.chaosTotemDurationSec = Math.max(0, items.chaosTotemDurationSec);
    } else if (typeof items.chaosTotemDuration === "string") {
      const m = /^(\d+):(\d{1,2})$/.exec(items.chaosTotemDuration.trim());
      if (m) {
        itemsIn.chaosTotemDurationMin = Number(m[1]);
        itemsIn.chaosTotemDurationSec = Number(m[2]);
      }
    }
  }

  return {
    params,
    stonksEnabled: gemev?.stonks_enabled ?? true,
    skillShardsEnabled: gemev?.skill_shards_enabled ?? true,
    statueSopranoLevel: clampInt(gemev?.statue_soprano_level ?? params.statue_soprano_level ?? 0, 0, 3),
    bankedFreebies: clampInt(gemev?.bankedFreebies ?? 0, 0, 999),
    chaosTotem100Uptime: bombs?.chaosTotem100Uptime ?? false,
    lootbug: lb.state,
    drone: dr.state,
    items: itemsIn,
    overnight: {
      sleepHours: typeof overnight?.sleepHours === "number" ? Math.max(0, overnight.sleepHours) : 8,
      gemBombActive: overnight?.gemBombActive ?? true,
      offlineNoElixirBuff: overnight?.offlineNoElixirBuff ?? false,
    },
    present: { gemev: gemev != null, bombs: bombs != null, lootbug: lb.present, drone: dr.present, items: items != null, overnight: overnight != null },
  };
}
