import { describe, expect, it } from "vitest";
import { defaultGameParameters, type GameParameters } from "../../gemev/freebieEv";
import { lootbugRates } from "../../lootbug/model";
import {
  DEFAULT_DRONE_STATE,
  bombBearSpawnRateMult,
  droneFuelDurationSecReal,
  elixirBomb10xMinPerHour,
  froggerBombEv,
  froggerSchedule,
  fuelDurationGameSec,
  fuelGemsPerHourForDuration,
  lootfrogStats,
  type ElixirState,
} from "../../drone/model";
import { itemsModel } from "../../items/model";
import { calculateCherryChargesGemsPerHour } from "../../gemev/freebieEv";
import { BEFORE_MOVED as B } from "./beforeMoved";

/**
 * The expected values in beforeMoved.ts were captured from the ORIGINAL component code (verbatim copies of the
 * useMemo bodies) before the pure parts moved into lib/. Same inputs must give the same outputs.
 */
const LB_BASE = { spawnRateMultiplier: 2.4333, tripleChancePct: 77, goldenChancePct: 25, gemCostReduction: 2, lootMultiplier: 1.91664, activeGemBuffs: ["10x Bomb Recharge"], bankCap: 24 };
const LB_CASES = [
  { state: LB_BASE, gs: 3.6103, bear: 1 },
  { state: { ...LB_BASE, activeGemBuffs: ["10x Bomb Recharge", "+100 Cherry Charges", "+3 Item Chests", "+1 Relic Chest", "Fishing +12 Ticks"] }, gs: 1, bear: 1.6 },
  { state: { spawnRateMultiplier: 1, tripleChancePct: 0, goldenChancePct: 0, gemCostReduction: 0, lootMultiplier: 1, activeGemBuffs: ["10x Bomb Recharge"], bankCap: 10 }, gs: 1, bear: 1 },
  { state: { ...LB_BASE, activeGemBuffs: ["+3 Item Chests"], goldenChancePct: 40 }, gs: 2.1, bear: 1.3 },
];

describe("Lootbug math moved to lib/lootbug/model.ts", () => {
  const gp = { ...defaultGameParameters(), game_speed_multiplier: 3.6103 };
  LB_CASES.forEach((c, i) => {
    it(`case ${i}`, () => {
      const r = lootbugRates(c.state, c.gs, c.bear);
      const b = B.lootbug[i];
      expect(r.spawnsPerHour).toBe(b.spawnsPerHour);
      expect(r.lootbugsPerHour).toBe(b.lootbugsPerHour);
      expect(r.expectedLootbugsPerSpawn).toBe(b.expectedLootbugsPerSpawn);
      expect(r.gemsPerHour).toBe(b.gemsPerHour);
      expect(r.bombRecharge10xMinPerHour).toBe(b.bombRecharge10xMinPerHour);
      expect(r.itemChestsPerHourFree).toBe(b.lootbugItemChestsPerHourFree);
      expect(r.itemChestsPerHourGem).toBe(b.lootbugItemChestsPerHourGem);
      expect(r.relicChestsPerHourFree).toBe(b.lootbugRelicChestsPerHourFree);
      expect(r.relicChestsPerHourGem).toBe(b.lootbugRelicChestsPerHourGem);
      expect(r.totalGemCostPerHour).toBe(b.totalGemCostPerHour);
      expect(calculateCherryChargesGemsPerHour(gp, r.cherryFreeChargesPerHour)).toBe(b.cherryChargesGemsPerHourFromLootbug);
      expect(calculateCherryChargesGemsPerHour(gp, r.cherry100ChargesPerHour)).toBe(b.cherry100GemEvPerHourFromLootbug);
    });
  });
});

const D: ElixirState = DEFAULT_DRONE_STATE;
const DR_BASE: ElixirState = { ...D, elixirDroneOn: true, elixirSuitLevel: 10, elixirGradeLevel: 15, fueled: true, gasolineGuzzler: false, fuelDurationUpgradeLevel: 101.1, fuelSaveChanceUpgradeLevel: 26.6, froggerDroneOn: true, froggerSuitLevel: 10, froggerGradeLevel: 14, froggerFueled: true, starburstDroneOn: true, starburstSuitLevel: 10, starburstGradeLevel: 20, starburstFueled: true, lootfrogsUnlocked: false };
const DR_CASES: { state: ElixirState; gs: number; bomb: Partial<GameParameters>; ext: { lootbugBomb10xMinPerHour?: number; chaosTotemUptimePct?: number } }[] = [
  { state: DR_BASE, gs: 3.6103, bomb: {}, ext: { lootbugBomb10xMinPerHour: 3.1589, chaosTotemUptimePct: 11.66 } },
  { state: DR_BASE, gs: 3.6103, bomb: { bomb_cycle: "late" }, ext: { lootbugBomb10xMinPerHour: 3.1589, chaosTotemUptimePct: 11.66 } },
  { state: { ...DR_BASE, gasolineGuzzler: true, axolotlSkin: true, miscFuelCardTier: 2, fuelDurationWorld3Level: 40, fuelDurationRelicLevel: 100, platinumStatueOfAppetite: true, upgradeFuelSaveChancePct: 5, elixirCritChanceFishing: true, bombBearDroneOn: true, bombBearFueled: true, bombBearGradeLevel: 10, anglerDroneOn: true, anglerFueled: true, anglerGradeLevel: 6, anglerSuitLevel: 10, chainBomberFueled: true, voidFueled: true, veinseekerFueled: true, chainBomberGradeLevel: 3, voidGradeLevel: 4, veinseekerGradeLevel: 5 }, gs: 1, bomb: { free_bomb_chance: 0.2, gem_bomb_recharge_card_level: 2 }, ext: {} },
  { state: { ...DR_BASE, fueled: false, froggerFueled: false, lootfrogsUnlocked: true, tripleLootfrogChancePct: 10, lootfrog10xChancePct: 5, goldenLootfrogChancePct: 20, bigLootfrogChancePct: 10, froggerGradeLevel: 30, lootfrogLootMultiplier: 1.5, lootfrogCapacity: 7 }, gs: 2, bomb: { has_megabomb: true }, ext: { lootbugBomb10xMinPerHour: 1, chaosTotemUptimePct: 0 } },
];

describe("Drone math moved to lib/drone/model.ts", () => {
  DR_CASES.forEach((c, i) => {
    it(`case ${i}`, () => {
      const b = B.drone[i];
      const s = c.state;
      const dur = (id: any) => droneFuelDurationSecReal(id, s, c.gs);
      expect(dur("elixir")).toBe(b.fuelDurationSecReal);
      expect(dur("frogger")).toBe(b.froggerFuelDurationSecReal);
      expect(dur("bear")).toBe(b.bombBearFuelDurationSecReal);
      expect(dur("angler")).toBe(b.anglerFuelDurationSecReal);
      expect(dur("starburst")).toBe(b.starburstFuelDurationSecReal);
      expect(dur("chain")).toBe(b.chainBomberFuelDurationSecReal);
      expect(dur("void")).toBe(b.voidFuelDurationSecReal);
      expect(dur("veinseeker")).toBe(b.veinseekerFuelDurationSecReal);
      expect(fuelDurationGameSec(210 + s.elixirGradeLevel * 10.5, s)).toBe(b.fuelDurationGameSec);
      expect(fuelGemsPerHourForDuration(dur("elixir"), s)).toBe(b.fuelGemsPerHour);
      expect(s.froggerFueled ? fuelGemsPerHourForDuration(dur("frogger"), s) : 0).toBe(b.froggerFuelGemsPerHour);
      expect(s.bombBearFueled ? fuelGemsPerHourForDuration(dur("bear"), s) : 0).toBe(b.bombBearFuelGemsPerHour);
      expect(s.anglerFueled ? fuelGemsPerHourForDuration(dur("angler"), s) : 0).toBe(b.anglerFuelGemsPerHour);
      expect(s.starburstFueled ? fuelGemsPerHourForDuration(dur("starburst"), s) : 0).toBe(b.starburstFuelGemsPerHour);
      expect(s.chainBomberFueled ? fuelGemsPerHourForDuration(dur("chain"), s) : 0).toBe(b.chainBomberFuelGemsPerHour);
      expect(s.voidFueled ? fuelGemsPerHourForDuration(dur("void"), s) : 0).toBe(b.voidFuelGemsPerHour);
      expect(s.veinseekerFueled ? fuelGemsPerHourForDuration(dur("veinseeker"), s) : 0).toBe(b.veinseekerFuelGemsPerHour);
      expect(bombBearSpawnRateMult(s)).toBe(b.bombBearLootbugSpawnRateMult);
      const x10 = elixirBomb10xMinPerHour(s, c.gs);
      expect(x10).toBe(b.droneBomb10xMinPerHour);
      const sched = froggerSchedule(s, c.gs);
      expect(sched.intervalSecReal).toBe(b.froggerBombIntervalSecReal);
      expect(sched.bombsPerAutofire).toBe(b.froggerBombsPerAutofire);

      // Frogger EV with the same params the original built from storage
      const params: GameParameters = { ...defaultGameParameters(), obelisk_level: 49, ...c.bomb } as GameParameters;
      params.total_bomb_types = 10 + ((params.include_founder_bomb_in_total ?? params.founder_enabled) ? 1 : 0) + (params.has_veinmorph_bomb ? 1 : 0) + (params.has_megabomb ? 1 : 0);
      params.bomb_recharge_10x_min_per_hour = (c.ext.lootbugBomb10xMinPerHour ?? 0) + x10;
      params.chaos_totem_uptime = (c.ext.chaosTotemUptimePct ?? 0) / 100;
      const ev = froggerBombEv(params, sched.intervalSecReal, sched.bombsPerAutofire);
      expect(ev.gemEvPerHour).toBe(b.froggerGemEvPerHour);
      expect(ev.totalBombTypes).toBe(b.totalBombTypesFromGemEv);
      expect(ev.bombsPerTypePerHour).toBeCloseTo(b.froggerBombsChartData.bombsPerTypeRows[0].value, 12);

      const lf = lootfrogStats(s, sched.intervalSecReal);
      expect(lf.lootfrogsPerHour).toBe(b.lootfrogsPerHour);
      expect(lf.valuePerFrogspawn).toBe(b.lootfrogValuePerFrogspawn);
      expect(lf.gemsPerHour).toBeCloseTo(b.lootfrogTotalGemsPerHour, 9);
    });
  });
});

describe("Items math moved to lib/items/model.ts", () => {
  const IT_CASES = [
    { inputs: { itemsPerChest: 2.3, chaosTotemDurationMin: 2, chaosTotemDurationSec: 53, chaosTotemObtainChance: 4.6 }, gs: 3.6103, chests: 76.2, chaos100: false, x10: 7.44, gem: { obelisk_level: 49, game_speed_multiplier: 3.6103 }, bombs: { free_bomb_chance: 0.2, cherry_bomb_triple_charge_chance: 0.105 } },
    { inputs: { itemsPerChest: 1, chaosTotemDurationMin: 2, chaosTotemDurationSec: 30, chaosTotemObtainChance: 4.6 }, gs: 1, chests: 30, chaos100: true, x10: 5, gem: {}, bombs: { bomb_cycle: "late" } },
    { inputs: { itemsPerChest: 1, chaosTotemDurationMin: 2, chaosTotemDurationSec: 30, chaosTotemObtainChance: 4.6 }, gs: 1.5, chests: 0, chaos100: false, x10: 0, gem: {}, bombs: {} },
  ];
  IT_CASES.forEach((c, i) => {
    it(`case ${i}`, () => {
      const b = B.items[i];
      const r = itemsModel({
        inputs: c.inputs,
        gameSpeedMult: c.gs,
        chestsPerHour: c.chests,
        chaosTotem100FromBombs: c.chaos100,
        bombParams: { ...defaultGameParameters(), ...c.gem, ...c.bombs } as GameParameters,
        total10xMinPerHour: c.x10,
      });
      expect(r.chaosTotemsPerHour).toBe(b.chaosTotemsPerHour);
      expect(r.expectedUptimeFraction).toBe(b.expectedUptimeFraction);
      expect(r.chargeMagnetGemsPerHour).toBe(b.chargeMagnetGemsPerHour);
      expect(r.chargeMagnetGemEvPerHour).toBe(b.chargeMagnetGemEvPerHour);
      expect(r.chaosTotemImpactLive).toBe(b.chaosTotemImpactLive);
      expect(r.valueOfOneChestGemPerHour).toBe(b.valueOfOneChestGemPerHour);
      expect(r.valueOfOneChestForLootbug).toBe(b.valueOfOneChestForLootbug);
      expect(r.chaosTotemValuePerTotemForGift).toBe(b.chaosTotemValuePerTotemForGift);
    });
  });
});
