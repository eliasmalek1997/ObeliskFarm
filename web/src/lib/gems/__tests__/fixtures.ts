import { vi } from "vitest";
import { applyStatsImport } from "../../importStats";

/**
 * The player of research/gems_player_analysis.md (export v2.2.52, Ob 49, W3, game speed 3.6103).
 * Stats subset that the importer maps, + the manual patches the analysis applied for unmapped inputs.
 * ASSUMED (not in the export): freebie timer upgrades 0, skill shards 12% x 12.5, recharge seconds 46/48/31/36 (author's tooltips),
 * gem chance 3%, no cards, Veinmorph owned, drone suit levels 10, coal fuel multiplier 1.011 as the total (+101.1%), guzzler off,
 * fuel save 26.6%, items per chest 2.3, Chaos Totem 2:53, 4.6%.
 * CONFIRMED by the player: 16 gems per freebie roll (= freebie_gems_bonus), jackpot (5x freebie) 13%.
 */
export const PLAYER_STATS = {
  obelisk_level: 49,
  worlds_unlocked: 3,
  game_speed_multi: 3.6103,
  freebie_cooldown_seconds: 420,
  freebie_refresh_chance: 6,
  freebie_gems_bonus: 16,
  freebie_5x_chance: 13,
  stonks_chance: 1,
  stonks_multi: 1.1,
  super_stonks_chance: 0,
  ultra_stonks_chance: 0,
  bomb_free_chance: 20,
  bomb_cherry3x_chance: 10.5,
  freebie_bank_cap: 35,
  lootbug_spawn_rate: 2.4333,
  lootbug_triple_chance: 77,
  lootbug_golden_chance: 25,
  lootbug_gem_cost_reduction: 2,
  lootbug_loot_multi: 1.91664,
  lootbug_bank_cap: 24,
  is_drone_elixir_equipped: true,
  is_drone_elixir_equipped_and_fueled: true,
  elixir_fuel_grade: 15,
  is_drone_frogger_equipped: true,
  is_drone_frogger_equipped_and_fueled: true,
  frogger_fuel_grade: 14,
  is_drone_starburst_equipped: true,
  is_drone_starburst_equipped_and_fueled: true,
  starburst_fuel_grade: 20,
  is_drone_bear_equipped: false,
  bear_fuel_grade: 10,
  is_drone_angler_equipped: false,
  angler_fuel_grade: 6,
  lootfrog_capacity: 5,
  lootfrog_loot_multi: 1,
};

const P = "obeliskfarm:web:";

/** Stub localStorage with the player's saves: importer output + manual patches. Returns the backing store. */
export function installPlayerStorage(patch: (store: Record<string, string>) => void = () => {}): Record<string, string> {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  });
  applyStatsImport({ ...PLAYER_STATS }, "2.2.52");
  const merge = (key: string, obj: Record<string, unknown>, nestedParams?: Record<string, unknown>) => {
    const cur = store[P + key] ? JSON.parse(store[P + key]!) : {};
    const next = { ...cur, ...obj };
    if (nestedParams) next.params = { ...(cur.params ?? {}), ...nestedParams };
    store[P + key] = JSON.stringify(next);
  };
  merge("gemev_save.json:v1", {}, { founder_enabled: false, include_founder_bomb_in_total: false });
  merge("bombs_save.json:v1", {}, { founder_enabled: false, include_founder_bomb_in_total: false });
  merge("drone_elixir_save.json:v9", {
    elixirSuitLevel: 10,
    froggerSuitLevel: 10,
    starburstSuitLevel: 10,
    fuelDurationUpgradeLevel: 101.1,
    gasolineGuzzler: false,
    fuelSaveChanceUpgradeLevel: 26.6,
    lootfrogsUnlocked: false,
    fishingUnlocked: true,
  });
  merge("items_save.json:v1", { itemsPerChest: 2.3, chaosTotemDurationMin: 2, chaosTotemDurationSec: 53 });
  patch(store);
  return store;
}
