/**
 * Gem income model: the player's gems/hour computed in ONE place from saved module inputs (see inputs.ts).
 * Pure and UI-free. It reuses lib/gemev/freebieEv.ts and the pure Lootbug / Drone / Items maths that moved into lib/.
 *
 * Differences from the classic Gem EV calculator ("fixed vs Gem EV calculator", also stated in each source's note):
 *  1. Frogger's bomb gem EV is an income (classic subtracts its fuel but never adds the EV).
 *  2. Fuel of drones whose benefit is not gems (Starburst, Angler, Chain Bomber, Void, Veinseeker) is reported in
 *     `nonGemCosts`, not subtracted. Fuel of Elixir / Frogger / Bomb Bear is a gem cost (their benefit is valued).
 *  3. Item chests are valued once (Charge Magnets over ALL chest sources); Lootbug gross and Gift EV no longer add a chest value.
 *     Chaos Totem uptime (from all chests) is applied inside the bomb term and is not valued per chest again.
 *  4. Lootbug 10x Bomb Recharge (and +100 Cherry / +3 Item Chests) count only when bought, or at the golden-proc rate when not.
 *     The Lootbug "10x gem EV" is NOT added on top of the bomb term (classic counted it twice).
 *  5. Stonks chance is the saved / imported value (toggle only switches it off), not a forced 1%.
 *  6. 10x Bomb Recharge minutes (Lootbug + Elixir) are capped at 60 min/h (still summed, not de-duplicated: UNVERIFIED stacking).
 *
 * Unavoidable / unmodelled (documented in `limitations`): see GEM_MODEL_LIMITATIONS.
 */
import {
  calculateChargeMagnetGemsPerHour,
  calculateCherryChargesGemsPerHour,
  calculateFounderGemsPerHour,
  calculateFreebieChestsPerHour,
  calculateFreebiesPerHour,
  calculateGemBombGemsPerHour,
  calculateGemsBasePerHour,
  calculateGiftSushiPerHourBySource,
  calculateSkillShardsEvPerHour,
  calculateStatueSopranoGiftEvPerHour,
  calculateStonksChestsPerHour,
  calculateStonksEvPerHour,
  getEffectiveGameSpeedMultiplierForTime,
  getEffectiveGemBombGemChance,
  getExpectedItemChestsPerGift,
  getFounderSupplyDropPerHour,
  getFreebieEvPerClaim,
  getGameSpeedMultiplier,
  type GameParameters,
} from "../gemev/freebieEv";
import {
  DRONE_DEFS,
  bombBearSpawnRateMult,
  droneFuelCostGemsPerHour,
  elixirBomb10xMinPerHour,
  froggerBombEv,
  froggerSchedule,
  lootfrogStats,
  type ElixirState,
} from "../drone/model";
import { itemsModel, CHARGE_MAGNET_OBTAIN_CHANCE_PCT } from "../items/model";
import { GEM_BUFFS } from "../lootbug/constants";
import { lootbugRates, type LootbugState } from "../lootbug/model";
import type { GemInputs, GemOverrides } from "./inputs";

export type GemSourceKind = "income" | "cost";

export type GemSource = {
  id: string;
  label: string;
  /** Positive number for both kinds (costs are subtracted by the totals). */
  gemsPerHour: number;
  kind: GemSourceKind;
  note?: string;
  /** True when this line differs from the classic Gem EV calculator (UI shows "fixed vs Gem EV calculator"). */
  fixed?: boolean;
  /** Optional per-item breakdown. */
  detail?: { label: string; gemsPerHour: number }[];
};

export type NonGemCost = { id: string; label: string; gemsPerHour: number; note: string };

export type GemMemo = { id: string; label: string; gemsPerHour: number; note: string };

export type GemSnapshot = {
  sources: GemSource[];
  grossPerHour: number;
  costPerHour: number;
  netPerHour: number;
  /** Real costs whose benefit is not gems; reported only, never subtracted. */
  nonGemCosts: NonGemCost[];
  /** Informational, NOT additive (already inside a source). */
  memos: GemMemo[];
  claim: {
    freebiesPerHour: number;
    freebieBankFillMinutes: number | null;
    lootbugSpawnsPerHour: number;
    lootbugBankFillMinutes: number | null;
    /** Claim at least this often so neither bank overflows (null when no bank is configured). */
    recommendedClaimEveryMinutes: number | null;
  };
  afk: {
    /** Gems/h accrued while away with the current drone fuel setup (auto-bomber + Elixir 10x + Frogger - fuel of gem drones). */
    netPerHourAfk: number;
    autoBomberGemsPerHour: number;
    froggerGemsPerHour: number;
    gemDroneFuelCostPerHour: number;
    /** Same with Elixir / Frogger / Bomb Bear unfueled. */
    netPerHourAfkUnfueled: number;
    /** One-time payout of the banked freebies / lootbugs when you come back. */
    bankedFreebiesGems: number;
    bankedLootbugsGems: number;
    note: string;
  };
  /** Intermediate quantities the UI / levers sometimes need. */
  rates: {
    gameSpeedForTime: number;
    freebiesPerHour: number;
    bomb10xMinPerHour: number;
    lootbug10xMinPerHour: number;
    elixir10xMinPerHour: number;
    chaosTotemUptime: number;
    chestsPerHour: number;
    chargeMagnetsPerHour: number;
    lootbugSpawnsPerHour: number;
    bombCycle: "early" | "late";
  };
  limitations: string[];
};

export const GEM_MODEL_LIMITATIONS: string[] = [
  "Elixir / Lootbug 2x Game Speed buffs are not converted to gems (they would speed freebies and bombs).",
  "Gem Bomb: 1 gem per proc and the refill rules are the original calculator's assumptions (UNVERIFIED).",
  "10x Bomb Recharge minutes from Lootbug and Elixir are summed (capped at 60/h), not de-duplicated; stacking with Chaos Totem is unverified.",
  "Lootbug buff weights use the full pool even for buffs you may not be able to roll; relic chests, ore, vein, star, arch and fishing buffs have no gem value.",
  "Gift 'Charge Magnets / 5x fishing tick' outcome is valued 0 when Fishing is unlocked (no gem value for fishing ticks).",
  "Bomb capacity, banked bomb charges, Buttery Lobster from gifts, mythic / relic / divine founder jackpots and fish-card gem levers are not modelled.",
  "Drone fuel is valued at 5 gems per fuel; coal fuel-duration multiplier is whatever the Drone module holds.",
];

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** Effective GameParameters for the model (Gem EV's effectiveParams without the cross-module reads). */
export function buildEffectiveParams(inputs: GemInputs, overrides: GemOverrides = {}): GameParameters {
  const p: GameParameters = { ...inputs.params };
  p.stonks_chance = inputs.stonksEnabled ? clamp(p.stonks_chance ?? 0.01, 0, 1) : 0;
  p.stonks_bonus_gems = 200.0;
  p.stonks_multiplier = clamp(p.stonks_multiplier ?? 1.0, 0, 999);
  p.super_stonks_chance = clamp(p.super_stonks_chance ?? 0, 0, 1);
  p.super_stonks_multiplier = clamp(p.super_stonks_multiplier ?? 2.0, 0, 999);
  p.ultra_stonks_chance = clamp(p.ultra_stonks_chance ?? 0, 0, 1);
  p.ultra_stonks_multiplier = clamp(p.ultra_stonks_multiplier ?? 25.0, 0, 999);
  p.stonks_all_multiplier = clamp(p.stonks_all_multiplier ?? 1.0, 0, 999);
  if (!inputs.skillShardsEnabled) p.skill_shard_chance = 0;
  p.statue_soprano_level = clampInt(inputs.statueSopranoLevel, 0, 3);
  p.founder_worlds_unlocked =
    typeof p.founder_worlds_unlocked === "number" && p.founder_worlds_unlocked >= 1 && p.founder_worlds_unlocked <= 4
      ? Math.trunc(p.founder_worlds_unlocked)
      : p.founder_enabled
        ? 2
        : undefined;
  p.founder_gems_base = 10.0;
  p.founder_gems_chance = 0.01;
  p.founder_speed_multiplier = 2.0;
  p.founder_speed_duration_minutes = 5.0;
  p.battery_bomb_charges_per_charge = 2.0;
  p.battery_bomb_cap_increase_chance = 0.001;
  p.founder_bomb_charges_per_drop = 2.0;
  p.founder_bomb_speed_chance = 0.1;
  p.founder_bomb_speed_multiplier = 2.0;
  p.founder_bomb_speed_duration_seconds = 10.0;
  p.jackpot_rolls = 5;

  const includeFounder = p.include_founder_bomb_in_total ?? p.founder_enabled;
  const hasVeinmorph = "has_veinmorph_bomb" in p ? p.has_veinmorph_bomb : true;
  const hasMegabomb = "has_megabomb" in p ? p.has_megabomb : false;
  p.total_bomb_types = 10 + (includeFounder ? 1 : 0) + (hasVeinmorph ? 1 : 0) + (hasMegabomb ? 1 : 0);

  p.skill_shard_chance = clamp(p.skill_shard_chance, 0, 1);
  p.jackpot_chance = clamp(p.jackpot_chance, 0, 1);
  p.instant_refresh_chance = clamp(p.instant_refresh_chance, 0, 1);
  p.freebie_relic_chance = clamp(p.freebie_relic_chance ?? 0, 0, 1);
  p.freebie_bonus_relic_chance = clamp(p.freebie_bonus_relic_chance ?? 0, 0, 1);
  p.free_bomb_chance = clamp(p.free_bomb_chance, 0, 0.99);
  p.gem_bomb_gem_chance = clamp(p.gem_bomb_gem_chance, 0, 1);
  p.cherry_bomb_triple_charge_chance = clamp(p.cherry_bomb_triple_charge_chance, 0, 1);
  p.d20_bomb_refill_chance = clamp(p.d20_bomb_refill_chance, 0, 1);
  p.vip_lounge_level = clampInt(p.vip_lounge_level, 1, 12);
  p.d20_bomb_charges_distributed = clampInt(p.d20_bomb_charges_distributed, 0, 9999);
  p.obelisk_level = clampInt(p.obelisk_level, 0, 999);
  p.founder_enabled = Boolean(p.founder_enabled);
  p.gem_bomb_recharge_card_level = clampInt(p.gem_bomb_recharge_card_level, 0, 3);
  p.cherry_bomb_recharge_card_level = clampInt(p.cherry_bomb_recharge_card_level, 0, 3);
  p.battery_bomb_recharge_card_level = clampInt(p.battery_bomb_recharge_card_level, 0, 3);
  p.d20_bomb_recharge_card_level = clampInt(p.d20_bomb_recharge_card_level, 0, 3);
  p.founder_bomb_recharge_card_level = clampInt(p.founder_bomb_recharge_card_level, 0, 3);
  p.game_speed_multiplier = clamp(Number("game_speed_multiplier" in p ? p.game_speed_multiplier : 1.0), 1.0, 10.0);
  p.w3_floor_debuff = Boolean(p.w3_floor_debuff);
  p.freebie_timer_minutes = clamp(p.freebie_timer_minutes, 0.1, 10_000);
  p.freebie_timer_upgrade_level = Math.max(0, Math.min(999, Math.trunc(p.freebie_timer_upgrade_level ?? 0)));
  p.gem_bomb_recharge_seconds = clamp(p.gem_bomb_recharge_seconds, 0.1, 10_000);
  p.cherry_bomb_recharge_seconds = clamp(p.cherry_bomb_recharge_seconds, 0.1, 10_000);
  p.battery_bomb_recharge_seconds = clamp(p.battery_bomb_recharge_seconds, 0.1, 10_000);
  p.d20_bomb_recharge_seconds = clamp(p.d20_bomb_recharge_seconds, 0.1, 10_000);
  p.founder_bomb_interval_seconds = clamp(p.founder_bomb_interval_seconds, 0.1, 10_000);
  p.founder_bomb_speed_multiplier = clamp(p.founder_bomb_speed_multiplier, 0.1, 100);
  p.founder_bomb_speed_duration_seconds = clamp(p.founder_bomb_speed_duration_seconds, 0, 10_000);

  if (typeof overrides.gemsPerFreebieRoll === "number" && Number.isFinite(overrides.gemsPerFreebieRoll)) p.freebie_gems_base = Math.max(0, overrides.gemsPerFreebieRoll);
  if (overrides.bombCycle === "early" || overrides.bombCycle === "late") p.bomb_cycle = overrides.bombCycle;
  return p;
}

/** Drone state with the page's what-if toggles applied. */
export function applyDroneOverrides(drone: ElixirState, overrides: GemOverrides): ElixirState {
  const d: ElixirState = { ...drone };
  const rec = d as unknown as Record<string, unknown>;
  for (const def of DRONE_DEFS) {
    const on = overrides.droneOn?.[def.id];
    const fu = overrides.droneFuel?.[def.id];
    if (typeof on === "boolean") rec[def.on as string] = on;
    if (typeof fu === "boolean") rec[def.fueled as string] = fu;
  }
  return d;
}

function rechargeMult(level: number): number {
  const l = Math.max(0, Math.min(3, Math.trunc(level)));
  return l === 1 ? 1.5 : l === 2 ? 2 : l === 3 ? 3 : 1;
}

/** Overnight auto-bomber (Cherry bomb) gems/h; same formula as modules/overnight (Chaos Totem not applied). */
function autoBomberGemsPerHour(pb: GameParameters, tenXMinPerHour: number, gs: number): number {
  const AUTO_BOMBER_INTERVAL_GAME_SEC = 1.25;
  const bomb10xFactor = 1 + 9 * (tenXMinPerHour / 60);
  const effCherrySec = Math.max(0.01, pb.cherry_bomb_recharge_seconds ?? 48) / gs / bomb10xFactor;
  const freeBombMult = 1 / (1 - Math.max(0, Math.min(0.99, pb.free_bomb_chance ?? 0)));
  const cherryRechargedPerHour = (3600 / effCherrySec) * rechargeMult(pb.cherry_bomb_recharge_card_level ?? 0) * freeBombMult;
  const dropsPerHour = 3600 / (AUTO_BOMBER_INTERVAL_GAME_SEC / gs);
  const effectiveCherryPerHour = Math.min(dropsPerHour, cherryRechargedPerHour);
  const cherryEffectMult = 1 + 2 * Math.max(0, Math.min(1, pb.cherry_bomb_triple_charge_chance ?? 0));
  return effectiveCherryPerHour * cherryEffectMult * getEffectiveGemBombGemChance(pb);
}

/** Full gem income snapshot. `overrides` are the page's what-if settings (see GemOverrides). */
export function computeGemSnapshot(inputs: GemInputs, overrides: GemOverrides = {}): GemSnapshot {
  const P = buildEffectiveParams(inputs, overrides);
  const drone = applyDroneOverrides(inputs.drone, overrides);
  const lbState: LootbugState = { ...inputs.lootbug, activeGemBuffs: overrides.lootbugBuy ?? inputs.lootbug.activeGemBuffs };
  const buy = new Set(lbState.activeGemBuffs);
  const gs = getEffectiveGameSpeedMultiplierForTime(P);
  const goldenPct = clamp(lbState.goldenChancePct, 0, 100) / 100;
  const lootMult = clamp(lbState.lootMultiplier, 0.1, 5);
  const chaos100 = inputs.chaosTotem100Uptime;

  // ---- Lootbug + Drone rates -------------------------------------------------------------------------------------
  const bearMult = bombBearSpawnRateMult(drone);
  const lb = lootbugRates(lbState, gs, bearMult);
  const rate = (name: string) => (buy.has(name) ? 1 : goldenPct); // bought -> every roll; else only golden (free) rolls
  const lootbug10xMin = lb.bombRecharge10xMinPerHour * rate("10x Bomb Recharge");
  const elixir10xMin = drone.elixirDroneOn ? elixirBomb10xMinPerHour(drone, gs) : 0;
  const total10x = Math.min(60, lootbug10xMin + elixir10xMin);

  // ---- Drone value pieces (also feed Gift EV) --------------------------------------------------------------------
  const sched = froggerSchedule(drone, gs);
  const lf = lootfrogStats(drone, sched.intervalSecReal);
  P.lootfrogs_unlocked = drone.lootfrogsUnlocked;
  P.gift_black_hole_unlocked = drone.lootfrogsUnlocked;
  P.gift_frogspawn_gem_value = lf.valuePerFrogspawn > 0 ? lf.valuePerFrogspawn : 0;
  P.gift_fishing_unlocked = drone.fishingUnlocked;
  P.gift_drone_fuel_gems_per_fuel = 5;
  // Chests are valued once via Charge Magnets (fix 3): Gift EV carries no per-chest / per-totem value.
  P.gift_item_chest_value = 0;
  P.gift_chaos_totem_value_per_totem = 0;
  P.gift_chaos_totem_100_from_bombs = true;

  // ---- Item chests -----------------------------------------------------------------------------------------------
  const founderDrop = getFounderSupplyDropPerHour(P);
  const gifts = calculateGiftSushiPerHourBySource(P);
  const giftsPerHour = gifts.giftPerHourFreebie + gifts.giftPerHourFounder;
  const lootbugChests = lb.itemChestsPerHourFree + lb.gemBuffRollsPerHour("+3 Item Chests") * 3 * lootMult * rate("+3 Item Chests");
  const chests = {
    freebie: calculateFreebieChestsPerHour(P),
    stonks: calculateStonksChestsPerHour(P),
    lootbug: lootbugChests,
    gift: giftsPerHour * getExpectedItemChestsPerGift(P),
    founder: founderDrop.itemChestsPerHour,
  };
  const chestsPerHour = chests.freebie + chests.stonks + chests.lootbug + chests.gift + chests.founder;

  const items = itemsModel({
    inputs: inputs.items,
    gameSpeedMult: getGameSpeedMultiplier(P),
    chestsPerHour,
    chaosTotem100FromBombs: chaos100,
    bombParams: P,
    total10xMinPerHour: total10x,
  });
  const chaosUptime = chaos100 ? 0 : overrides.chaosTotemFull ? 1 : items.expectedUptimeFraction;

  // Bomb params with 10x and Chaos Totem applied (chaos uptime is applied to the bomb term: fix 3)
  const Pb: GameParameters = { ...P, bomb_recharge_10x_min_per_hour: total10x, chaos_totem_uptime: chaosUptime };

  P.gift_charge_magnet_value_per_magnet = !drone.fishingUnlocked ? calculateChargeMagnetGemsPerHour(Pb, 20) : undefined;

  // ---- Income sources --------------------------------------------------------------------------------------------
  const sources: GemSource[] = [];
  const memos: GemMemo[] = [];
  const nonGemCosts: NonGemCost[] = [];
  const add = (s: GemSource) => {
    if (s.gemsPerHour !== 0 || s.kind === "income") sources.push(s);
  };

  const freebiesPerHour = calculateFreebiesPerHour(P);
  add({ id: "freebie_gems", label: "Freebie gems", gemsPerHour: calculateGemsBasePerHour(P), kind: "income", note: "Pops/h x instant refresh x expected rolls (jackpot) x gems per roll." });
  add({ id: "stonks", label: "Stonks", gemsPerHour: calculateStonksEvPerHour(P), kind: "income", fixed: true, note: `Uses the saved/imported Stonks chance (${(P.stonks_chance * 100).toFixed(2)}%), not a forced 1%.` });
  add({ id: "skill_shards", label: "Skill shards", gemsPerHour: calculateSkillShardsEvPerHour(P), kind: "income", note: "12.5 gems per shard is an unverified constant." });
  if (P.statue_soprano_level) add({ id: "soprano_gifts", label: "Statue of Soprano gifts", gemsPerHour: calculateStatueSopranoGiftEvPerHour(P), kind: "income", fixed: true, note: "Gift EV carries no separate chest value; chests are counted once in Charge Magnets." });
  if (P.founder_enabled) {
    add({ id: "founder", label: "Founder supply drop", gemsPerHour: calculateFounderGemsPerHour(P), kind: "income" });
    add({ id: "founder_lobster", label: "Buttery Lobster (founder)", gemsPerHour: founderDrop.butteryLobsterPerHour * inputs.bankedFreebies * getFreebieEvPerClaim(P), kind: "income" });
  }

  const bombGems = calculateGemBombGemsPerHour(Pb);
  const bombWithout10xLootbug = calculateGemBombGemsPerHour({ ...Pb, bomb_recharge_10x_min_per_hour: Math.min(60, elixir10xMin) });
  const bombWithoutChaos = calculateGemBombGemsPerHour({ ...Pb, chaos_totem_uptime: 0 });
  add({
    id: "gem_bomb",
    label: "Gem Bomb cycle",
    gemsPerHour: bombGems,
    kind: "income",
    fixed: true,
    note: `Cycle ${P.bomb_cycle}. Includes 10x Bomb Recharge (${total10x.toFixed(2)} min/h: Lootbug counted only when bought or golden) and Chaos Totem uptime ${(chaosUptime * 100).toFixed(1)}% from your chests.`,
  });
  memos.push({ id: "lootbug_10x_in_bombs", label: "of which Lootbug 10x Bomb Recharge", gemsPerHour: Math.max(0, bombGems - bombWithout10xLootbug), note: "Already inside Gem Bomb cycle (classic Gem EV added it a second time)." });
  memos.push({ id: "chaos_in_bombs", label: "of which Chaos Totem", gemsPerHour: Math.max(0, bombGems - bombWithoutChaos), note: chaos100 ? "100% uptime: bomb recharge seconds already include it." : "Already inside Gem Bomb cycle." });

  const magnetsPerHour = inputs.items.itemsPerChest * chestsPerHour * (CHARGE_MAGNET_OBTAIN_CHANCE_PCT / 100);
  const magnetValue = calculateChargeMagnetGemsPerHour(Pb, 20);
  add({
    id: "charge_magnets",
    label: "Charge Magnets (all item chests)",
    gemsPerHour: magnetsPerHour * magnetValue,
    kind: "income",
    fixed: true,
    note: "Chests from freebies, stonks, Lootbug, gifts and founder are counted once here; Lootbug and Gift EV no longer add a chest value on top.",
    detail: [
      { label: "Freebie chests/h", gemsPerHour: chests.freebie },
      { label: "Stonks chests/h", gemsPerHour: chests.stonks },
      { label: "Lootbug chests/h", gemsPerHour: chests.lootbug },
      { label: "Gift chests/h", gemsPerHour: chests.gift },
      { label: "Founder chests/h", gemsPerHour: chests.founder },
    ],
  });

  // Lootbug
  add({ id: "lootbug_gems", label: "Lootbug +2 Gems", gemsPerHour: lb.gemsPerHour, kind: "income" });
  const cherryCharges = lb.cherryFreeChargesPerHour;
  const cherry100 = lb.cherry100ChargesPerHour;
  const cherryGems = calculateCherryChargesGemsPerHour(Pb, cherryCharges) + calculateCherryChargesGemsPerHour(Pb, cherry100);
  if (cherryGems > 0) add({ id: "lootbug_cherry", label: "Lootbug Cherry Charges", gemsPerHour: cherryGems, kind: "income", fixed: true, note: "+10 free and +100 (bought or golden) valued with your bomb cycle; classic Gem EV left these out of the total." });
  const lbCostDetail: { label: string; gemsPerHour: number }[] = [];
  for (const buff of GEM_BUFFS) {
    if (!buy.has(buff.name)) continue;
    const perHour = lb.gemBuffRollsPerHour(buff.name);
    const actualCost = Math.max(0, buff.cost - lbState.gemCostReduction);
    lbCostDetail.push({ label: buff.name, gemsPerHour: perHour * actualCost * (1 - goldenPct) });
  }
  if (lb.totalGemCostPerHour > 0) add({ id: "lootbug_buys", label: "Lootbug gem-buff purchases", gemsPerHour: lb.totalGemCostPerHour, kind: "cost", note: `${[...buy].join(", ")}; golden ${(goldenPct * 100).toFixed(0)}% free.`, detail: lbCostDetail });

  // Drones
  if (drone.froggerDroneOn) {
    const frog = froggerBombEv(Pb, sched.intervalSecReal, sched.bombsPerAutofire);
    add({ id: "frogger_bombs", label: "Frogger autofire bombs", gemsPerHour: frog.gemEvPerHour, kind: "income", fixed: true, note: `${sched.bombsPerAutofire} bomb(s) every ${sched.intervalSecReal.toFixed(1)} s. Classic Gem EV subtracted Frogger's fuel but never added this.` });
  }
  if (lf.gemsPerHour > 0) add({ id: "lootfrogs", label: "Lootfrog rewards", gemsPerHour: lf.gemsPerHour, kind: "income" });
  for (const def of DRONE_DEFS) {
    const cost = droneFuelCostGemsPerHour(def.id, drone, gs);
    if (cost <= 0) continue;
    if (def.gemRelevant) {
      add({ id: `fuel_${def.id}`, label: `${def.label} fuel`, gemsPerHour: cost, kind: "cost", note: def.id === "elixir" ? "Benefit: 10x Bomb Recharge (inside Gem Bomb cycle)." : def.id === "frogger" ? "Benefit: Frogger autofire bombs." : "Benefit: Lootbug spawn rate." });
    } else {
      nonGemCosts.push({
        id: `fuel_${def.id}`,
        label: `${def.label} fuel`,
        gemsPerHour: cost,
        note: `Not subtracted: ${def.label}'s benefit is not gems (classic Gem EV subtracted it).`,
      });
    }
  }

  const grossPerHour = sources.filter((s) => s.kind === "income").reduce((s, x) => s + x.gemsPerHour, 0);
  const costPerHour = sources.filter((s) => s.kind === "cost").reduce((s, x) => s + x.gemsPerHour, 0);

  // ---- Claim cadence ---------------------------------------------------------------------------------------------
  const freebieFill = inputs.bankedFreebies > 0 && freebiesPerHour > 0 ? (inputs.bankedFreebies / freebiesPerHour) * 60 : null;
  const lootbugFill = lbState.bankCap > 0 && lb.spawnsPerHour > 0 ? (lbState.bankCap / lb.spawnsPerHour) * 60 : null;
  const fills = [freebieFill, lootbugFill].filter((x): x is number => x != null);

  // ---- AFK -------------------------------------------------------------------------------------------------------
  const away = !inputs.overnight.offlineNoElixirBuff;
  const afkCalc = (d: ElixirState) => {
    const x10 = away && d.elixirDroneOn ? elixirBomb10xMinPerHour(d, gs) : 0;
    const pAfk: GameParameters = { ...P, bomb_recharge_10x_min_per_hour: Math.min(60, x10), chaos_totem_uptime: 0 };
    const auto = inputs.overnight.gemBombActive ? autoBomberGemsPerHour(pAfk, x10, gs) : 0;
    const s2 = froggerSchedule(d, gs);
    const frogGems = away && d.froggerDroneOn ? froggerBombEv(pAfk, s2.intervalSecReal, s2.bombsPerAutofire).gemEvPerHour : 0;
    let fuel = 0;
    for (const def of DRONE_DEFS) {
      if (!def.gemRelevant || def.id === "bear") continue;
      if (def.id === "elixir" && !away) continue;
      fuel += droneFuelCostGemsPerHour(def.id, d, gs);
    }
    return { auto, frogGems, fuel, net: auto + frogGems - fuel };
  };
  const afkNow = afkCalc(drone);
  const unfueled: ElixirState = { ...drone, fueled: false, froggerFueled: false, bombBearFueled: false };
  const afkUnfueled = afkCalc(unfueled);
  const freebieEvPerClaim = getFreebieEvPerClaim(P);
  const lootbugPerSpawn = lb.spawnsPerHour > 0 ? (lb.gemsPerHour + calculateCherryChargesGemsPerHour(Pb, cherryCharges) - lb.totalGemCostPerHour) / lb.spawnsPerHour : 0;

  return {
    sources,
    grossPerHour,
    costPerHour,
    netPerHour: grossPerHour - costPerHour,
    nonGemCosts,
    memos,
    claim: {
      freebiesPerHour,
      freebieBankFillMinutes: freebieFill,
      lootbugSpawnsPerHour: lb.spawnsPerHour,
      lootbugBankFillMinutes: lootbugFill,
      recommendedClaimEveryMinutes: fills.length ? Math.min(...fills) : null,
    },
    afk: {
      netPerHourAfk: afkNow.net,
      autoBomberGemsPerHour: afkNow.auto,
      froggerGemsPerHour: afkNow.frogGems,
      gemDroneFuelCostPerHour: afkNow.fuel,
      netPerHourAfkUnfueled: afkUnfueled.net,
      bankedFreebiesGems: inputs.bankedFreebies * freebieEvPerClaim,
      bankedLootbugsGems: lbState.bankCap * lb.expectedLootbugsPerSpawn > 0 ? lbState.bankCap * lootbugPerSpawn : 0,
      note: "Auto-bomber fires Cherry bombs only; freebie/lootbug banks pay out once and stop growing when full. Lootbug 10x does not accrue while away.",
    },
    rates: {
      gameSpeedForTime: gs,
      freebiesPerHour,
      bomb10xMinPerHour: total10x,
      lootbug10xMinPerHour: lootbug10xMin,
      elixir10xMinPerHour: elixir10xMin,
      chaosTotemUptime: chaosUptime,
      chestsPerHour,
      chargeMagnetsPerHour: magnetsPerHour,
      lootbugSpawnsPerHour: lb.spawnsPerHour,
      bombCycle: P.bomb_cycle,
    },
    limitations: GEM_MODEL_LIMITATIONS,
  };
}
