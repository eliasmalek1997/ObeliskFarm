/**
 * Import a pasted game-stats JSON export (the "stats" block of the in-game export) into the
 * localStorage saves of the individual modules.
 *
 * Design:
 * - Every module already persists its inputs under an `obeliskfarm:web:*` key and reads them on mount.
 *   The importer merges the mapped fields into those saved states (it never wipes unrelated fields).
 * - Only fields that map unambiguously are applied. Everything else is reported back to the user.
 * - Chance fields: the export uses percent (e.g. 42.0), modules store either percent or 0..1 fractions;
 *   each mapping below converts accordingly.
 */
import { loadJson, saveJson } from "./storage";
import { ALL_FISH, ENHANCEMENTS_T1, ENHANCEMENTS_T2, FISHING_UPGRADES_T1, FISHING_UPGRADES_T2 } from "./fishing/constants";

const PREFIX = "obeliskfarm:web:";
const KEYS = {
  stargazing: `${PREFIX}stargazing_save.json:v1`,
  stargazingExternal: `${PREFIX}stargazing_external.json`,
  gemev: `${PREFIX}gemev_save.json:v1`,
  gemevExternal: `${PREFIX}gemev_external.json`,
  bombs: `${PREFIX}bombs_save.json:v1`,
  lootbug: `${PREFIX}lootbug_save.json:v1`,
  veins: `${PREFIX}veins_save.json:v2`,
  fishing: `${PREFIX}fishing_save.json:v1`,
  drone: `${PREFIX}drone_elixir_save.json:v9`,
  droneLegacy: [8, 7, 6, 5, 4, 3, 2, 1].map((v) => `${PREFIX}drone_elixir_save.json:v${v}`),
};

export type ImportedStats = Record<string, unknown>;

export type ModuleReport = {
  module: string;
  /** Human readable "label ← source_field = value" lines. */
  applied: string[];
};

export type ImportReport = {
  version: string | null;
  modules: ModuleReport[];
  /** Top-level stat keys that no module consumed. */
  unusedKeys: string[];
  /** Notes the user should read (assumptions, things deliberately not applied). */
  notes: string[];
};

export type ParseResult = { ok: true; stats: ImportedStats; version: string | null } | { ok: false; error: string };

/** Accepts the full export ({"time","version","stats":{...}}) or just the stats object. Tolerates stray text around the JSON. */
export function parseStatsJson(text: string): ParseResult {
  let raw = text.trim();
  if (!raw) return { ok: false, error: "Nothing pasted." };
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  let parsed = tryParse(raw);
  if (parsed === undefined) {
    // Chat apps and mobile keyboards sometimes add smart quotes or surrounding text.
    raw = raw.replace(/[“”]/g, '"');
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) parsed = tryParse(raw.slice(first, last + 1));
  }
  if (parsed === undefined || parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "That is not valid JSON. Paste the whole export, starting with { and ending with }." };
  }
  const root = parsed as Record<string, unknown>;
  const version = typeof root.version === "string" ? root.version : null;
  const inner = root.stats;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return { ok: true, stats: inner as ImportedStats, version };
  }
  // Allow pasting just the stats object.
  if ("star_spawn_rate" in root || "bomb_damage" in root || "regular_upgrades_array" in root) {
    return { ok: true, stats: root, version };
  }
  return { ok: false, error: 'No "stats" object found in that JSON.' };
}

function fmtVal(v: unknown): string {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return v.toExponential(3);
    return String(Math.round(v * 1e4) / 1e4);
  }
  return String(v);
}

/** Collects what a module import did, and which stat keys it consumed. */
class Collector {
  readonly used = new Set<string>();
  readonly lines: string[] = [];
  constructor(private readonly stats: ImportedStats) {}

  num(key: string): number | undefined {
    const v = this.stats[key];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  }
  bool(key: string): boolean | undefined {
    const v = this.stats[key];
    return typeof v === "boolean" ? v : undefined;
  }
  arr(key: string): number[] | undefined {
    const v = this.stats[key];
    if (!Array.isArray(v)) return undefined;
    return v.map((x) => (typeof x === "number" && Number.isFinite(x) ? x : 0));
  }
  /** Read a number, run it through `conv`, assign to target[field] and log it. */
  setNum<T extends Record<string, unknown>>(
    target: T,
    field: string,
    label: string,
    key: string,
    conv: (n: number) => number = (n) => n,
  ): void {
    const n = this.num(key);
    if (n === undefined) return;
    const out = conv(n);
    if (!Number.isFinite(out)) return;
    (target as Record<string, unknown>)[field] = out;
    this.used.add(key);
    this.lines.push(`${label} ← ${key} = ${fmtVal(n)}`);
  }
  setBool<T extends Record<string, unknown>>(target: T, field: string, label: string, key: string): void {
    const b = this.bool(key);
    if (b === undefined) return;
    (target as Record<string, unknown>)[field] = b;
    this.used.add(key);
    this.lines.push(`${label} ← ${key} = ${b ? "yes" : "no"}`);
  }
}

const pct01 = (n: number) => n / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const int = (n: number) => Math.max(0, Math.trunc(n));

function loadObj(key: string): Record<string, unknown> {
  const v = loadJson<unknown>(key);
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

// ——— Stargazing ———
function importStargazing(stats: ImportedStats): { report: ModuleReport | null; used: Set<string> } {
  const c = new Collector(stats);
  const ui: Record<string, unknown> = {};
  c.setNum(ui, "star_spawn_rate_mult", "Star spawn rate ×", "star_spawn_rate");
  c.setNum(ui, "auto_catch_chance", "Auto-catch %", "star_auto_catch_chance");
  c.setNum(ui, "double_star_chance", "Double star %", "star_double_spawn_chance");
  c.setNum(ui, "triple_star_chance", "Triple star %", "star_triple_spawn_chance");
  c.setNum(ui, "super_star_spawn_rate_mult", "Super star spawn rate ×", "super_star_spawn_multi");
  c.setNum(ui, "triple_super_star_chance", "Triple super star %", "super_star_triple_chance");
  c.setNum(ui, "super_star_10x_chance", "Super star 10× %", "super_star_10x_chance");
  c.setNum(ui, "star_supernova_chance", "Supernova %", "star_supernova_chance");
  c.setNum(ui, "star_supernova_mult", "Supernova ×", "star_supernova_multi");
  c.setNum(ui, "star_supergiant_chance", "Supergiant %", "star_supergiant_chance");
  c.setNum(ui, "star_supergiant_mult", "Supergiant ×", "star_supergiant_multi");
  c.setNum(ui, "star_radiant_chance", "Radiant %", "star_radiant_chance");
  c.setNum(ui, "star_radiant_mult", "Radiant ×", "star_radiant_multi");
  c.setNum(ui, "super_star_supernova_chance", "Super star supernova %", "super_star_supernova_chance");
  c.setNum(ui, "super_star_supernova_mult", "Super star supernova ×", "super_star_supernova_multi");
  c.setNum(ui, "super_star_supergiant_chance", "Super star supergiant %", "super_star_supergiant_chance");
  c.setNum(ui, "super_star_supergiant_mult", "Super star supergiant ×", "super_star_supergiant_multi");
  c.setNum(ui, "super_star_radiant_chance", "Super star radiant %", "super_star_radiant_chance");
  c.setNum(ui, "super_star_radiant_mult", "Super star radiant ×", "super_star_radiant_multi");
  c.setNum(ui, "all_star_mult", "All star multi ×", "all_star_multi");
  c.setNum(ui, "novagiant_combo_mult", "Novagiant combo ×", "novagiant_combo_multi");
  if (Object.keys(ui).length === 0) return { report: null, used: c.used };

  const saved = loadObj(KEYS.stargazing);
  const prevStats = saved.stats && typeof saved.stats === "object" ? (saved.stats as Record<string, unknown>) : {};
  saved.stats = { ...prevStats, ...ui };
  saveJson(KEYS.stargazing, saved);

  // Drone reads this flag from the Stargazing external key on mount; keep it consistent with the equipped drone.
  const sb = c.bool("is_drone_starburst_equipped");
  if (sb !== undefined) {
    const ext = loadObj(KEYS.stargazingExternal);
    ext.starburstDroneOn = sb;
    saveJson(KEYS.stargazingExternal, ext);
    c.used.add("is_drone_starburst_equipped");
  }
  return { report: { module: "Stargazing", applied: c.lines }, used: c.used };
}

// ——— Gem EV + Bombs (shared GameParameters) ———
function importGemEvAndBombs(stats: ImportedStats): { gemev: ModuleReport | null; bombs: ModuleReport | null; used: Set<string> } {
  const used = new Set<string>();
  const params: Record<string, unknown> = {};
  const c = new Collector(stats);

  // Shared (Gem EV freebies/stonks/speed)
  c.setNum(params, "game_speed_multiplier", "Game speed ×", "game_speed_multi", (n) => clamp(n, 1, 10));
  c.setNum(params, "obelisk_level", "Obelisk level", "obelisk_level", int);
  c.setNum(params, "freebie_timer_minutes", "Freebie timer (min)", "freebie_cooldown_seconds", (n) => n / 60);
  c.setNum(params, "freebie_gems_base", "Freebie gems per roll", "freebie_gems_bonus", (n) => Math.max(0, n));
  c.setNum(params, "jackpot_chance", "Jackpot chance (5× freebie)", "freebie_5x_chance", (n) => clamp(pct01(n), 0, 1));
  c.setNum(params, "instant_refresh_chance", "Instant refresh chance", "freebie_refresh_chance", (n) => clamp(pct01(n), 0, 1));
  c.setNum(params, "stonks_chance", "Stonks chance", "stonks_chance", (n) => clamp(pct01(n), 0, 1));
  c.setNum(params, "stonks_multiplier", "Stonks ×", "stonks_multi");
  c.setNum(params, "super_stonks_chance", "Super Stonks chance", "super_stonks_chance", (n) => clamp(pct01(n), 0, 1));
  c.setNum(params, "super_stonks_multiplier", "Super Stonks ×", "super_stonks_multi");
  c.setNum(params, "ultra_stonks_chance", "Ultra Stonks chance", "ultra_stonks_chance", (n) => clamp(pct01(n), 0, 1));
  c.setNum(params, "ultra_stonks_multiplier", "Ultra Stonks ×", "ultra_stonks_multi");
  c.setNum(params, "founder_worlds_unlocked", "Worlds unlocked", "worlds_unlocked", (n) => clamp(Math.trunc(n), 1, 4));
  const gemevLines = [...c.lines];
  const gemevUsed = new Set(c.used);

  // Bomb-only
  const b = new Collector(stats);
  const bombParams: Record<string, unknown> = {};
  b.setNum(bombParams, "free_bomb_chance", "Free bomb chance", "bomb_free_chance", (n) => clamp(pct01(n), 0, 0.99));
  b.setNum(bombParams, "cherry_bomb_triple_charge_chance", "Cherry triple-charge chance", "bomb_cherry3x_chance", (n) =>
    clamp(pct01(n), 0, 1),
  );
  const bombLines = [...b.lines];
  b.used.forEach((k) => used.add(k));
  gemevUsed.forEach((k) => used.add(k));

  // Banked freebies cap lives next to params in the Gem EV save.
  const bankCap = c.num("freebie_bank_cap");

  const gemevSaved = loadObj(KEYS.gemev);
  const bombsSaved = loadObj(KEYS.bombs);
  const gemevHas = Object.keys(params).length > 0 || Object.keys(bombParams).length > 0 || bankCap !== undefined;

  let gemev: ModuleReport | null = null;
  let bombs: ModuleReport | null = null;

  if (gemevHas) {
    const prev = gemevSaved.params && typeof gemevSaved.params === "object" ? (gemevSaved.params as Record<string, unknown>) : {};
    gemevSaved.params = { ...prev, ...params, ...bombParams };
    const lines = [...gemevLines, ...bombLines];
    if (bankCap !== undefined) {
      gemevSaved.bankedFreebies = clamp(Math.trunc(bankCap), 0, 999);
      used.add("freebie_bank_cap");
      lines.push(`Banked freebies cap ← freebie_bank_cap = ${fmtVal(bankCap)}`);
    }
    saveJson(KEYS.gemev, gemevSaved);
    gemev = { module: "Gem EV", applied: lines };
  }

  if (Object.keys(params).length > 0 || Object.keys(bombParams).length > 0) {
    const prev = bombsSaved.params && typeof bombsSaved.params === "object" ? (bombsSaved.params as Record<string, unknown>) : {};
    bombsSaved.params = { ...prev, ...params, ...bombParams };
    saveJson(KEYS.bombs, bombsSaved);
    bombs = { module: "Bombs", applied: [...gemevLines.filter((l) => /^Game speed|^Obelisk/.test(l)), ...bombLines] };
  }

  // Bombs / Veins read game speed from the Gem EV external key even while Gem EV is not mounted.
  const gs = c.num("game_speed_multi");
  if (gs !== undefined) {
    const ext = loadObj(KEYS.gemevExternal);
    ext.game_speed_multiplier = clamp(gs, 1, 10);
    saveJson(KEYS.gemevExternal, ext);
  }
  return { gemev, bombs, used };
}

// ——— Lootbug ———
function importLootbug(stats: ImportedStats): { report: ModuleReport | null; used: Set<string> } {
  const c = new Collector(stats);
  const s: Record<string, unknown> = {};
  c.setNum(s, "spawnRateMultiplier", "Spawn rate ×", "lootbug_spawn_rate");
  c.setNum(s, "tripleChancePct", "Triple chance %", "lootbug_triple_chance");
  c.setNum(s, "goldenChancePct", "Golden chance %", "lootbug_golden_chance");
  c.setNum(s, "gemCostReduction", "Gem cost reduction", "lootbug_gem_cost_reduction", (n) => clamp(Math.trunc(n), 0, 999));
  c.setNum(s, "lootMultiplier", "Loot multiplier ×", "lootbug_loot_multi");
  c.setNum(s, "bankCap", "Banked lootbugs cap", "lootbug_bank_cap");
  if (Object.keys(s).length === 0) return { report: null, used: c.used };
  saveJson(KEYS.lootbug, { ...loadObj(KEYS.lootbug), ...s });
  return { report: { module: "Lootbug", applied: c.lines }, used: c.used };
}

// ——— Veins ———
function importVeins(stats: ImportedStats): { report: ModuleReport | null; used: Set<string> } {
  const c = new Collector(stats);
  const s: Record<string, unknown> = {};
  c.setNum(s, "floor", "Floor", "current_floor", (n) => Math.max(1, Math.trunc(n)));
  c.setNum(s, "oresPerFloor", "Ores per floor", "ores_per_screen", (n) => Math.max(1, Math.trunc(n)));
  c.setNum(s, "veinSpawnRateMult", "Vein spawn rate ×", "vein_spawn_rate_multi");
  c.setNum(s, "veinIncomeMult", "Vein income ×", "vein_income_multi");
  c.setNum(s, "goldenChancePct", "Golden vein %", "golden_vein_chance");
  c.setNum(s, "goldenMult", "Golden vein ×", "golden_vein_multi");
  c.setNum(s, "rainbowChancePct", "Rainbow vein %", "rainbow_vein_chance");
  c.setNum(s, "rainbowMult", "Rainbow vein ×", "rainbow_vein_multi");
  c.setNum(s, "gleamingChancePct", "Gleaming vein %", "gleaming_vein_chance");
  c.setNum(s, "gleamingMult", "Gleaming vein ×", "gleaming_vein_multi");
  c.setNum(s, "voidPortalChancePct", "Void portal %", "void_portal_chance");
  c.setNum(s, "voidPortalMult", "Void portal ×", "void_portal_multi");
  c.setNum(s, "goldenPortalChancePct", "Golden portal %", "golden_void_portal_chance");
  c.setNum(s, "goldenPortalMult", "Golden portal ×", "golden_void_portal_multi");
  c.setNum(s, "rainbowPortalChancePct", "Rainbow portal %", "rainbow_void_portal_chance");
  c.setNum(s, "rainbowPortalMult", "Rainbow portal ×", "rainbow_void_portal_multi");
  c.setBool(s, "voidDroneOn", "Void drone on", "is_drone_void_equipped");
  if (Object.keys(s).length === 0) return { report: null, used: c.used };
  saveJson(KEYS.veins, { ...loadObj(KEYS.veins), ...s });
  return { report: { module: "Veins", applied: c.lines }, used: c.used };
}

// ——— Fishing ———
function importFishing(stats: ImportedStats): { report: ModuleReport | null; used: Set<string>; notes: string[] } {
  const c = new Collector(stats);
  const notes: string[] = [];
  const saved = loadObj(KEYS.fishing);
  let changed = false;

  const upgradeIds = [...FISHING_UPGRADES_T1, ...FISHING_UPGRADES_T2].map((u) => u.id);
  const upgrades = c.arr("fishing_upgrades_array");
  if (upgrades) {
    if (upgrades.length >= upgradeIds.length) {
      const levels: Record<string, number> = {};
      upgradeIds.forEach((id, i) => {
        levels[id] = int(upgrades[i] ?? 0);
      });
      saved.upgradeLevels = levels;
      c.used.add("fishing_upgrades_array");
      c.lines.push(`Upgrade levels (${upgradeIds.length}) ← fishing_upgrades_array`);
      changed = true;
    } else {
      notes.push(`fishing_upgrades_array has ${upgrades.length} entries, expected ${upgradeIds.length}; skipped.`);
    }
  }

  const enhanceIds = [...ENHANCEMENTS_T1, ...ENHANCEMENTS_T2].map((u) => u.id);
  const enh = c.arr("fishing_enhance_array");
  if (enh) {
    if (enh.length >= enhanceIds.length) {
      const levels: Record<string, number> = {};
      enhanceIds.forEach((id, i) => {
        levels[id] = int(enh[i] ?? 0);
      });
      saved.enhanceLevels = levels;
      c.used.add("fishing_enhance_array");
      c.lines.push(`Enhancement levels (${enhanceIds.length}) ← fishing_enhance_array`);
      changed = true;
    } else {
      notes.push(`fishing_enhance_array has ${enh.length} entries, expected ${enhanceIds.length}; skipped.`);
    }
  }

  const cards = c.arr("fishing_regular_card_array");
  if (cards) {
    if (cards.length >= ALL_FISH.length) {
      const tiers: Record<string, number> = {};
      ALL_FISH.forEach((f, i) => {
        const t = clamp(Math.trunc(cards[i] ?? 0), 0, 3);
        if (t > 0) tiers[f.id] = t;
      });
      saved.fishCardTier = tiers;
      c.used.add("fishing_regular_card_array");
      c.lines.push(`Fish card tiers (${ALL_FISH.length} fish) ← fishing_regular_card_array`);
      notes.push("Fish card tiers assume the export lists fish in the same order as the Fishing module (dock by dock, 4 per dock). Spot-check a few cards.");
      changed = true;
    } else {
      notes.push(`fishing_regular_card_array has ${cards.length} entries, expected ${ALL_FISH.length}; skipped.`);
    }
  }

  // The game's own totals, so the Fishing page can show which inputs still differ.
  const ingame = {
    rodPower: c.num("fishing_rod_power"),
    droneCap: c.num("fishing_drone_capacity"),
    droneMulti: c.num("fishing_drone_multiplier"),
    incomeMulti: c.num("fishing_income_multi"),
  };
  if (Object.values(ingame).some((v) => v !== undefined)) {
    saveJson(`${PREFIX}fishing_ingame.json`, ingame);
    ["fishing_rod_power", "fishing_drone_capacity", "fishing_drone_multiplier", "fishing_income_multi"].forEach((k) => {
      if (k in stats) c.used.add(k);
    });
  }

  if (!changed) return { report: null, used: c.used, notes };
  saveJson(KEYS.fishing, saved);
  return { report: { module: "Fishing", applied: c.lines }, used: c.used, notes };
}

// ——— Drone ———
const DRONES: Array<{ label: string; stat: string; on: string; fueled: string; grade: string }> = [
  { label: "Elixir", stat: "elixir", on: "elixirDroneOn", fueled: "fueled", grade: "elixirGradeLevel" },
  { label: "Frogger", stat: "frogger", on: "froggerDroneOn", fueled: "froggerFueled", grade: "froggerGradeLevel" },
  { label: "Bomb Bear", stat: "bear", on: "bombBearDroneOn", fueled: "bombBearFueled", grade: "bombBearGradeLevel" },
  { label: "Angler", stat: "angler", on: "anglerDroneOn", fueled: "anglerFueled", grade: "anglerGradeLevel" },
  { label: "Starburst", stat: "starburst", on: "starburstDroneOn", fueled: "starburstFueled", grade: "starburstGradeLevel" },
  { label: "Chain Bomber", stat: "chain", on: "chainBomberDroneOn", fueled: "chainBomberFueled", grade: "chainBomberGradeLevel" },
  { label: "Void", stat: "void", on: "voidDroneOn", fueled: "voidFueled", grade: "voidGradeLevel" },
  { label: "Veinseeker", stat: "veinseeker", on: "veinseekerDroneOn", fueled: "veinseekerFueled", grade: "veinseekerGradeLevel" },
];

function importDrone(stats: ImportedStats): { report: ModuleReport | null; used: Set<string>; notes: string[] } {
  const c = new Collector(stats);
  const notes: string[] = [];
  const d: Record<string, unknown> = {};

  for (const dr of DRONES) {
    c.setBool(d, dr.on, `${dr.label} drone on`, `is_drone_${dr.stat}_equipped`);
    c.setBool(d, dr.fueled, `${dr.label} fueled`, `is_drone_${dr.stat}_equipped_and_fueled`);
    c.setNum(d, dr.grade, `${dr.label} grade`, `${dr.stat}_fuel_grade`, (n) => Math.max(0, Math.trunc(n)));
  }
  c.setNum(d, "gameSpeedMultiplier", "Game speed ×", "game_speed_multi", (n) => clamp(n, 1, 10));
  c.setNum(d, "lootfrogLootMultiplier", "Lootfrog loot ×", "lootfrog_loot_multi");
  c.setNum(d, "lootfrogCapacity", "Lootfrog capacity", "lootfrog_capacity");
  c.setNum(d, "tripleLootfrogChancePct", "Triple lootfrog %", "lootfrog_triple_spawn_chance");
  c.setNum(d, "lootfrog10xChancePct", "10× lootfrog %", "lootfrog_10x_spawn_chance");
  c.setNum(d, "goldenLootfrogChancePct", "Golden lootfrog %", "lootfrog_golden_chance");
  c.setNum(d, "goldenLootfrogMultiplier", "Golden lootfrog ×", "lootfrog_golden_multi");
  c.setNum(d, "bigLootfrogChancePct", "Big lootfrog %", "lootfrog_big_chance");
  c.setNum(d, "bigLootfrogMultiplier", "Big lootfrog ×", "lootfrog_big_multi");

  if (Object.keys(d).length === 0) return { report: null, used: c.used, notes };

  // Drone keeps the newest of several versioned keys; start from whichever exists so nothing is lost.
  let base: Record<string, unknown> = {};
  for (const k of [KEYS.drone, ...KEYS.droneLegacy]) {
    const v = loadJson<unknown>(k);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      base = { ...(v as Record<string, unknown>) };
      break;
    }
  }
  saveJson(KEYS.drone, { ...base, ...d });
  notes.push("Drone suit levels are not imported: drones_suit_level_array has no drone names, so the order can't be verified.");
  return { report: { module: "Drone", applied: c.lines }, used: c.used, notes };
}

/** Writes the mapped values into the module saves and returns a report of what happened. */
export function applyStatsImport(stats: ImportedStats, version: string | null): ImportReport {
  const modules: ModuleReport[] = [];
  const used = new Set<string>();
  const notes: string[] = [
    "Values are the game's current totals. If a drone buff or elixir was active when you exported, it is already included in them.",
  ];

  const sg = importStargazing(stats);
  if (sg.report) modules.push(sg.report);
  sg.used.forEach((k) => used.add(k));

  const ge = importGemEvAndBombs(stats);
  if (ge.gemev) modules.push(ge.gemev);
  if (ge.bombs) modules.push(ge.bombs);
  ge.used.forEach((k) => used.add(k));

  const lb = importLootbug(stats);
  if (lb.report) modules.push(lb.report);
  lb.used.forEach((k) => used.add(k));

  const ve = importVeins(stats);
  if (ve.report) modules.push(ve.report);
  ve.used.forEach((k) => used.add(k));

  const fi = importFishing(stats);
  if (fi.report) modules.push(fi.report);
  fi.used.forEach((k) => used.add(k));
  notes.push(...fi.notes);

  const dr = importDrone(stats);
  if (dr.report) modules.push(dr.report);
  dr.used.forEach((k) => used.add(k));
  notes.push(...dr.notes);

  const unusedKeys = Object.keys(stats).filter((k) => !used.has(k));
  return { version, modules, unusedKeys, notes };
}
