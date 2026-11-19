/**
 * Cross-module inputs of the Fishing model, read from localStorage (written by the Drone, Lootbug and
 * Gem EV modules). Same logic that used to live inline in `Fishing.tsx`.
 */

import { loadJson } from "../storage";
import {
  calculateGift5xTickUptimeFraction,
  calculateGiftSushiPerHour,
  calculateGiftSushiPerHourBySource,
  defaultGameParameters,
  type GameParameters,
} from "../gemev/freebieEv";

export const FISHING_EXTERNAL_KEY = "obeliskfarm:web:fishing_external.json";
export const GEMEV_EXTERNAL_KEY = "obeliskfarm:web:gemev_external.json";
const LOOTBUG_STORAGE_KEY = "obeliskfarm:web:lootbug_save.json:v1";
const GEMEV_STORAGE_KEY = "obeliskfarm:web:gemev_save.json:v1";

/** Gem EV total gems/h (0 when Gem EV has never been opened / synced). */
export function readGemsPerHour(): number {
  const ext = loadJson<{ totalGemsPerHour?: number }>(GEMEV_EXTERNAL_KEY);
  return typeof ext?.totalGemsPerHour === "number" && ext.totalGemsPerHour > 0 ? ext.totalGemsPerHour : 0;
}

/** Values the Drone / Lootbug / Gem EV modules publish for Fishing (all 0 when unsynced). */
export type FishingExternalData = ReturnType<typeof readFishingExternal>;

/** Read Elixir 3x uptime, Angler / Lootbug / Gift / Lootfrog ticks and sushi rates. */
export function readFishingExternal() {
  const ext = loadJson<{
    elixir3xFishingTickSpeedMinPerHour?: number;
    elixir3xFishingTickSpeedUptimeFraction?: number;
    anglerTicksPerHour?: number;
    anglerBaseTicksPerHour?: number;
    anglerBuffTicksPerHour?: number;
    anglerLegendaryBonusPct?: number;
    anglerBuffUptimeFraction?: number;
    lootbugFishing12TicksProcsPerHour?: number;
    giftSushiPerHour?: number;
    giftSushiFreebiePerHour?: number;
    giftSushiFounderPerHour?: number;
    lootfrogSushiPerHour?: number;
  }>(FISHING_EXTERNAL_KEY);
  const minPerHour = typeof ext?.elixir3xFishingTickSpeedMinPerHour === "number" ? ext.elixir3xFishingTickSpeedMinPerHour : 0;
  const uptimeFraction =
    typeof ext?.elixir3xFishingTickSpeedUptimeFraction === "number"
      ? Math.max(0, Math.min(1, ext.elixir3xFishingTickSpeedUptimeFraction))
      : 0;
  const anglerTicksPerHour = typeof ext?.anglerTicksPerHour === "number" ? Math.max(0, ext.anglerTicksPerHour) : 0;
  const anglerBaseTicksPerHour = typeof ext?.anglerBaseTicksPerHour === "number" ? Math.max(0, ext.anglerBaseTicksPerHour) : 0;
  const anglerBuffTicksPerHour = typeof ext?.anglerBuffTicksPerHour === "number" ? Math.max(0, ext.anglerBuffTicksPerHour) : 0;
  const anglerLegendaryBonusPct = typeof ext?.anglerLegendaryBonusPct === "number" ? Math.max(0, Math.min(52, ext.anglerLegendaryBonusPct)) : 0;
  const anglerBuffUptimeFraction = typeof ext?.anglerBuffUptimeFraction === "number" ? Math.max(0, Math.min(1, ext.anglerBuffUptimeFraction)) : 0;

  const rawLootbug = typeof ext?.lootbugFishing12TicksProcsPerHour === "number" ? Math.max(0, ext.lootbugFishing12TicksProcsPerHour) : 0;
  const lootbugState = loadJson<{ activeGemBuffs?: string[] }>(LOOTBUG_STORAGE_KEY);
  const buyGemBuffs = Array.isArray(lootbugState?.activeGemBuffs) ? lootbugState.activeGemBuffs : [];
  const lootbugFishing12TicksProcsPerHour = buyGemBuffs.includes("Fishing +12 Ticks") ? rawLootbug : 0;

  const gemevExt = loadJson<{ fishingUnlocked?: boolean }>(GEMEV_EXTERNAL_KEY);
  const fishingUnlocked = gemevExt?.fishingUnlocked !== false;
  let giftSushiPerHour = 0;
  let giftSushiFreebiePerHour = 0;
  let giftSushiFounderPerHour = 0;
  let giftPerHourFreebie = 0;
  let giftPerHourFounder = 0;
  let gift5xTickUptimeFraction = 0;
  if (fishingUnlocked) {
    const gemevSave = loadJson<{ params?: Partial<GameParameters>; statue_soprano_level?: number }>(GEMEV_STORAGE_KEY);
    const def = defaultGameParameters();
    const params: GameParameters = { ...def, ...gemevSave?.params } as GameParameters;
    if (typeof gemevSave?.statue_soprano_level === "number") {
      params.statue_soprano_level = Math.max(0, Math.min(3, gemevSave.statue_soprano_level));
    }
    giftSushiPerHour = Math.max(0, calculateGiftSushiPerHour(params));
    const bySource = calculateGiftSushiPerHourBySource(params);
    giftSushiFreebiePerHour = Math.max(0, bySource.freebie);
    giftSushiFounderPerHour = Math.max(0, bySource.founder);
    giftPerHourFreebie = Math.max(0, bySource.giftPerHourFreebie ?? 0);
    giftPerHourFounder = Math.max(0, bySource.giftPerHourFounder ?? 0);
    gift5xTickUptimeFraction = calculateGift5xTickUptimeFraction(params);
  }
  const lootfrogSushiPerHour = typeof ext?.lootfrogSushiPerHour === "number" ? Math.max(0, ext.lootfrogSushiPerHour) : 0;

  return { elixir3xFishingExternal: { minPerHour, uptimeFraction }, anglerTicksPerHour, anglerBaseTicksPerHour, anglerBuffTicksPerHour, anglerLegendaryBonusPct, anglerBuffUptimeFraction, lootbugFishing12TicksProcsPerHour, giftSushiPerHour, giftSushiFreebiePerHour, giftSushiFounderPerHour, giftPerHourFreebie, giftPerHourFounder, gift5xTickUptimeFraction, lootfrogSushiPerHour };
}
