/**
 * Display strings for "next level" effects of upgrades / enhancements (e.g. "1.16×→1.32×").
 * Pure; moved unchanged from the classic Fishing page.
 */

import type { ComputedFishingStats } from "./computeStats";
import type { EnhanceId, FishingUpgradeId } from "./types";

/** Format "current→next" for the stat this upgrade changes. Used under upgrade name. Always show only this upgrade's own value (from 0), e.g. 0→1, 1.00×→1.05×. Pass upgradeLevels for level. */
export function formatUpgradeNextEffect(
  upgradeId: FishingUpgradeId,
  current: ComputedFishingStats,
  next: ComputedFishingStats,
  upgradeLevels?: Partial<Record<FishingUpgradeId, number>>,
): string | null {
  switch (upgradeId) {
    case "fishing_rod": {
      const lvl = Math.floor(Number(upgradeLevels?.fishing_rod ?? 0));
      const base = 10;
      const cur = Math.round(base * Math.pow(1.16, lvl));
      const next = Math.round(base * Math.pow(1.16, lvl + 1));
      return `${cur}→${next}`;
    }
    case "fishing_drone": {
      const lvl = Math.floor(Number(upgradeLevels?.fishing_drone ?? 0));
      const perLvl = 1;
      return `${lvl * perLvl}→${(lvl + 1) * perLvl}`;
    }
    case "fishing_drone_2": {
      const lvl = Math.floor(Number(upgradeLevels?.fishing_drone_2 ?? 0));
      const perLvl = 2;
      return `${lvl * perLvl}→${(lvl + 1) * perLvl}`;
    }
    case "upgrade_boat": {
      const lvl = Math.floor(Number(upgradeLevels?.upgrade_boat ?? 0));
      return `${lvl}→${lvl + 1}`;
    }
    case "upgrade_t2_boat": {
      const lvl = Math.floor(Number(upgradeLevels?.upgrade_t2_boat ?? 0));
      return `${lvl}→${lvl + 1}`;
    }
    case "tick_speed": {
      const lvl = Math.floor(Number(upgradeLevels?.tick_speed ?? 0));
      const perLvl = -0.5;
      return `${(perLvl * lvl).toFixed(1)}s→${(perLvl * (lvl + 1)).toFixed(1)}s`;
    }
    case "fish_multiplier": {
      const lvl = Math.floor(Number(upgradeLevels?.fish_multiplier ?? 0));
      const curFactor = 1 + 0.03 * lvl;
      const nextFactor = 1 + 0.03 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "rod_multiplier": {
      const lvl = Math.floor(Number(upgradeLevels?.rod_multiplier ?? 0));
      const curFactor = 1 + 0.04 * lvl;
      const nextFactor = 1 + 0.04 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "drone_multiplier": {
      const lvl = Math.floor(Number(upgradeLevels?.drone_multiplier ?? 0));
      const curFactor = 1 + 0.06 * lvl;
      const nextFactor = 1 + 0.06 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "drone_base_power": {
      const lvl = Math.floor(Number(upgradeLevels?.drone_base_power ?? 0));
      const perLvl = 0.25;
      return `${(perLvl * lvl).toFixed(2)}→${(perLvl * (lvl + 1)).toFixed(2)}`;
    }
    case "drone_cloner": {
      const lvl = Math.floor(Number(upgradeLevels?.drone_cloner ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "shiny_multiplier": {
      const lvl = Math.floor(Number(upgradeLevels?.shiny_multiplier ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "poly_card_multi": {
      const lvl = Math.floor(Number(upgradeLevels?.poly_card_multi ?? 0));
      const curFactor = 1 + 0.08 * lvl;
      const nextFactor = 1 + 0.08 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "double_tick_chance": {
      const lvl = Math.floor(Number(upgradeLevels?.double_tick_chance ?? 0));
      const pct = 0.5;
      return `${(pct * lvl).toFixed(1)}→${(pct * (lvl + 1)).toFixed(2)}%`;
    }
    case "shiny_fish_chance": {
      const lvl = Math.floor(Number(upgradeLevels?.shiny_fish_chance ?? 0));
      const pct = 0.5;
      return `${(pct * lvl).toFixed(1)}→${(pct * (lvl + 1)).toFixed(2)}%`;
    }
    case "triple_tick_chance": {
      const lvl = Math.floor(Number(upgradeLevels?.triple_tick_chance ?? 0));
      const pct = 0.35;
      return `${(pct * lvl).toFixed(1)}→${(pct * (lvl + 1)).toFixed(2)}%`;
    }
    case "tier2_dock_power": {
      const lvl = Math.floor(Number(upgradeLevels?.tier2_dock_power ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "super_shiny_chance": {
      const lvl = Math.floor(Number(upgradeLevels?.super_shiny_chance ?? 0));
      const pct = 1;
      return `${(pct * lvl).toFixed(1)}→${(pct * (lvl + 1)).toFixed(2)}%`;
    }
    default:
      return null;
  }
}

/** Format "current→next" for the stat this enhancement changes. Used under enhancement name. Always show only this enhancement's own value (from 0), e.g. 0→1, 1.00×→1.05×. Pass enhanceLevels for level. New enhancements must follow this pattern. */
export function formatEnhanceNextEffect(
  enhanceId: EnhanceId,
  current: ComputedFishingStats,
  next: ComputedFishingStats,
  enhanceLevels?: Partial<Record<EnhanceId, number>>,
): string | null {
  switch (enhanceId) {
    case "enhance_fish_multiplier": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_fish_multiplier ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "enhance_fishing_drone": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_fishing_drone ?? 0));
      const perLvl = 1;
      return `${lvl * perLvl}→${(lvl + 1) * perLvl}`;
    }
    case "enhance_fishing_drone_3": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_fishing_drone_3 ?? 0));
      const perLvl = 3;
      return `${lvl * perLvl}→${(lvl + 1) * perLvl}`;
    }
    case "enhance_rod_multiplier": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_rod_multiplier ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "enhance_tick_speed": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_tick_speed ?? 0));
      const perLvl = -0.5;
      return `${(perLvl * lvl).toFixed(1)}s→${(perLvl * (lvl + 1)).toFixed(1)}s`;
    }
    case "enhance_drone_multiplier": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_drone_multiplier ?? 0));
      const curFactor = 1 + 0.08 * lvl;
      const nextFactor = 1 + 0.08 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "enhance_token_multiplier": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_token_multiplier ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "enhance_shiny_multiplier": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_shiny_multiplier ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "enhance_double_tick_chance": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_double_tick_chance ?? 0));
      const pct = 0.5;
      return `${(pct * lvl).toFixed(1)}→${(pct * (lvl + 1)).toFixed(2)}%`;
    }
    case "enhance_triple_tick_chance": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_triple_tick_chance ?? 0));
      const pct = 0.4;
      return `${(pct * lvl).toFixed(1)}→${(pct * (lvl + 1)).toFixed(2)}%`;
    }
    case "enhance_tier2_dock_power": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_tier2_dock_power ?? 0));
      const curFactor = 1 + 0.05 * lvl;
      const nextFactor = 1 + 0.05 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "enhance_tier2_dock_ticks": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_tier2_dock_ticks ?? 0));
      const perLvl = -1;
      return `${lvl * perLvl}→${(lvl + 1) * perLvl}`;
    }
    case "enhance_super_shiny_multi": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_super_shiny_multi ?? 0));
      const curFactor = 1 + 0.15 * lvl;
      const nextFactor = 1 + 0.15 * (lvl + 1);
      return `${curFactor.toFixed(2)}×→${nextFactor.toFixed(2)}×`;
    }
    case "enhance_poly_card_multi": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_poly_card_multi ?? 0));
      const curBonus = 0.1 * lvl;
      const nextBonus = 0.1 * (lvl + 1);
      return `+${curBonus.toFixed(2)}×→+${nextBonus.toFixed(2)}×`;
    }
    case "enhance_tiny_notice_chance": {
      const lvl = Math.floor(Number(enhanceLevels?.enhance_tiny_notice_chance ?? 0));
      const pct = 0.5;
      return `${(pct * lvl).toFixed(1)}→${(pct * (lvl + 1)).toFixed(2)}%`;
    }
    default:
      return null;
  }
}
