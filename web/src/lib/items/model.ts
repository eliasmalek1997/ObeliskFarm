/**
 * Pure Items math (Chaos Totem uptime, Charge Magnet value) moved out of modules/items/Items.tsx and the
 * Charge Magnet fallback in modules/gemev/GemEv.tsx. Formulas unchanged (pinned by lib/gems/__tests__/moved.test.ts).
 */
import { calculateChargeMagnetGemsPerHour, calculateGemBombGemsPerHour, type GameParameters } from "../gemev/freebieEv";

/** Charge Magnet obtain chance from Item Chests (%), from wiki. */
export const CHARGE_MAGNET_OBTAIN_CHANCE_PCT = 2.6;

export type ItemsInputs = {
  /** Items obtained from opening one Item Chest. */
  itemsPerChest: number;
  chaosTotemDurationMin: number;
  chaosTotemDurationSec: number;
  /** Chaos Totem obtain chance from chests (%). */
  chaosTotemObtainChance: number;
};

export const DEFAULT_ITEMS_INPUTS: ItemsInputs = {
  itemsPerChest: 1,
  chaosTotemDurationMin: 2,
  chaosTotemDurationSec: 30,
  chaosTotemObtainChance: 4.6,
};

/** Bomb params with the Chaos Totem recharge applied to "base" recharge seconds simulated away (100% mode: seconds are in-game, so x2). */
function withDoubledRecharge(p: GameParameters): GameParameters {
  return {
    ...p,
    gem_bomb_recharge_seconds: (p.gem_bomb_recharge_seconds ?? 1) * 2,
    cherry_bomb_recharge_seconds: (p.cherry_bomb_recharge_seconds ?? 1) * 2,
    battery_bomb_recharge_seconds: (p.battery_bomb_recharge_seconds ?? 1) * 2,
    d20_bomb_recharge_seconds: (p.d20_bomb_recharge_seconds ?? 1) * 2,
  };
}

/** Gem EV of Chaos Totem when the player has 100% uptime and the bomb recharge fields are already in-game values (/2). */
export function chaosTotemImpact100(p: GameParameters): number {
  const withChaos = calculateGemBombGemsPerHour(p);
  const withoutChaos = calculateGemBombGemsPerHour(withDoubledRecharge(p));
  return Math.max(0, withChaos - withoutChaos);
}

export type ItemsModel = {
  chaosTotemsPerHour: number;
  durationGameMin: number;
  expectedUptimeFraction: number;
  chargeMagnetsPerHour: number;
  chargeMagnetGemsPerHour: number;
  chargeMagnetGemEvPerHour: number;
  chaosTotemImpactLive: number;
  valueOfOneChestGemPerHour: number;
  valueOfOneChestForLootbug: number;
  chaosTotemValuePerTotemForGift: number;
};

/**
 * @param bombParams merged GameParameters (bomb fields, VIP, etc.); 10x and chaos uptime are set here.
 * @param total10xMinPerHour Lootbug + Drone 10x Bomb Recharge minutes/h.
 */
export function itemsModel(args: {
  inputs: ItemsInputs;
  gameSpeedMult: number;
  chestsPerHour: number;
  chaosTotem100FromBombs: boolean;
  bombParams: GameParameters;
  total10xMinPerHour: number;
}): ItemsModel {
  const { inputs: state, gameSpeedMult, chestsPerHour, chaosTotem100FromBombs } = args;
  const itemsPerHourFromChests = state.itemsPerChest * chestsPerHour;
  const chaosTotemsPerHour = itemsPerHourFromChests * (state.chaosTotemObtainChance / 100);
  const durationGameMin = state.chaosTotemDurationMin + state.chaosTotemDurationSec / 60;
  const expectedUptimeMinPerHour = chaosTotemsPerHour * (durationGameMin / gameSpeedMult);
  const expectedUptimeFraction = Math.min(1, Math.max(0, expectedUptimeMinPerHour / 60));

  const p: GameParameters = { ...args.bombParams };
  p.bomb_recharge_10x_min_per_hour = args.total10xMinPerHour;
  // When 100% from Bombs, recharge params are in-game values (already /2), so do not apply Chaos again.
  p.chaos_totem_uptime = chaosTotem100FromBombs ? 0 : expectedUptimeFraction;
  const chargeMagnetGemsPerHour = calculateChargeMagnetGemsPerHour(p, 20);
  const chargeMagnetsPerHour = itemsPerHourFromChests * (CHARGE_MAGNET_OBTAIN_CHANCE_PCT / 100);
  const chargeMagnetGemEvPerHour = chargeMagnetsPerHour * chargeMagnetGemsPerHour;

  const chaosTotemImpactLive = chaosTotem100FromBombs
    ? chaosTotemImpact100(p)
    : calculateGemBombGemsPerHour(p) - calculateGemBombGemsPerHour({ ...p, chaos_totem_uptime: 0 });

  const chaosValuePerChestWhen100 = (() => {
    if (!chaosTotem100FromBombs || chaosTotemImpactLive <= 0 || durationGameMin <= 0) return 0;
    const totemsPerHourToSustain60 = (60 * gameSpeedMult) / durationGameMin;
    const valuePerTotem = chaosTotemImpactLive / totemsPerHourToSustain60;
    const chaosTotemsPerChest = state.itemsPerChest * (state.chaosTotemObtainChance / 100);
    return chaosTotemsPerChest * valuePerTotem;
  })();

  const valueOfOneChestGemPerHour =
    state.itemsPerChest * (CHARGE_MAGNET_OBTAIN_CHANCE_PCT / 100) * chargeMagnetGemsPerHour +
    (chaosTotem100FromBombs ? chaosValuePerChestWhen100 : chestsPerHour > 0 ? chaosTotemImpactLive / chestsPerHour : 0);
  const chargeMagnetPartOfChest = state.itemsPerChest * (CHARGE_MAGNET_OBTAIN_CHANCE_PCT / 100) * chargeMagnetGemsPerHour;
  const valueOfOneChestForLootbug = chaosTotem100FromBombs ? chargeMagnetPartOfChest : valueOfOneChestGemPerHour;
  const chaosTotemValuePerTotemForGift =
    chaosTotem100FromBombs || chaosTotemsPerHour <= 0 ? 0 : chaosTotemImpactLive / chaosTotemsPerHour;

  return {
    chaosTotemsPerHour,
    durationGameMin,
    expectedUptimeFraction,
    chargeMagnetsPerHour,
    chargeMagnetGemsPerHour,
    chargeMagnetGemEvPerHour,
    chaosTotemImpactLive,
    valueOfOneChestGemPerHour,
    valueOfOneChestForLootbug,
    chaosTotemValuePerTotemForGift,
  };
}

/** Gem EV/h of all chests' Charge Magnets when Items has not published chargeMagnetImpact (GemEv.tsx fallback). */
export function chargeMagnetImpactFallback(params: GameParameters, chestsPerHour: number, itemsPerChest: number): number {
  const chargeMagnetsPerHour = chestsPerHour * itemsPerChest * 0.026;
  const valuePerMagnet = calculateChargeMagnetGemsPerHour(params, 20);
  return chargeMagnetsPerHour * valuePerMagnet;
}
