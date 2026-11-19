import { afterEach, describe, expect, it, vi } from "vitest";
import { installPlayerStorage } from "./fixtures";
import { BOMB_PARAM_KEYS, mergeGemParams, readGemInputs } from "../inputs";
import { computeGemSnapshot, type GemSnapshot } from "../model";
import { planFreeChanges, rankGemLevers } from "../levers";
import { defaultGameParameters } from "../../gemev/freebieEv";

afterEach(() => vi.unstubAllGlobals());

const src = (s: GemSnapshot, id: string) => s.sources.find((x) => x.id === id)?.gemsPerHour ?? 0;

/**
 * Player of research/gems_player_analysis.md. Analysis (app, early cycle, 9 gems/roll): freebies 450.4, stonks 72.4, shards 75.1,
 * bombs 40.5, Lootbug +2 gems 43.7, Lootbug cost -29.0, fuel Elixir -64.5 / Frogger -77.6 / Starburst -74.1, Frogger EV 71.9 (early) / ~150.4 (late).
 * With the confirmed 16 gems/roll freebies are 800.6 (analysis: 453.3 -> 803.5 app total).
 */
describe("player totals (analysis fixture)", () => {
  function snap(cycle: "early" | "late") {
    installPlayerStorage();
    const inputs = readGemInputs();
    vi.unstubAllGlobals(); // the model must not read storage
    return { inputs, s: computeGemSnapshot(inputs, { bombCycle: cycle }) };
  }

  it("imports the confirmed values", () => {
    installPlayerStorage();
    const i = readGemInputs();
    expect(i.params.freebie_gems_base).toBe(16);
    expect(i.params.jackpot_chance).toBeCloseTo(0.13, 10);
    expect(i.params.game_speed_multiplier).toBeCloseTo(3.6103, 6);
    expect(i.bankedFreebies).toBe(35);
    expect(i.lootbug.bankCap).toBe(24);
  });

  it("matches the analysis per source (early cycle)", () => {
    const { s } = snap("early");
    expect(src(s, "freebie_gems")).toBeCloseTo(800.6, 0);
    expect(src(s, "stonks")).toBeCloseTo(72.4, 0);
    expect(src(s, "skill_shards")).toBeCloseTo(75.1, 0);
    expect(src(s, "lootbug_gems")).toBeCloseTo(43.7, 0);
    expect(src(s, "lootbug_buys")).toBeCloseTo(29.0, 0);
    expect(src(s, "fuel_elixir")).toBeCloseTo(64.5, 0);
    expect(src(s, "fuel_frogger")).toBeCloseTo(77.6, 0);
    expect(src(s, "frogger_bombs")).toBeCloseTo(71.9, 0);
    // bomb term: analysis 40.5 without Chaos Totem; Chaos Totem (~5 gems/h) is now applied
    expect(src(s, "gem_bomb")).toBeGreaterThan(40.5);
    expect(src(s, "gem_bomb")).toBeLessThan(50);
    expect(s.rates.bomb10xMinPerHour).toBeCloseTo(7.44, 1);
    expect(s.rates.lootbugSpawnsPerHour).toBeCloseTo(26.35, 1);
  });

  it("net totals: early ~ analysis adjusted figure + 7 gems/roll, late higher", () => {
    const e = snap("early").s;
    const l = snap("late").s;
    // analysis adjusted 590 (9 gems/roll) + 7 x 50 = ~940; we add Lootbug cherry, Chaos Totem and golden chests (+~10)
    expect(e.netPerHour).toBeGreaterThan(930);
    expect(e.netPerHour).toBeLessThan(965);
    expect(l.netPerHour).toBeGreaterThan(1080);
    expect(l.netPerHour).toBeLessThan(1115);
    expect(src(l, "frogger_bombs")).toBeCloseTo(150.4, 0);
    expect(e.netPerHour).toBeCloseTo(e.grossPerHour - e.costPerHour, 9);
  });

  it("reports Starburst fuel as non-gem cost, not subtracted", () => {
    const { s } = snap("early");
    expect(s.nonGemCosts.map((x) => x.id)).toEqual(["fuel_starburst"]);
    expect(s.nonGemCosts[0]!.gemsPerHour).toBeCloseTo(74.07, 1);
    expect(s.costPerHour).toBeCloseTo(29.01 + 64.55 + 77.56, 1);
  });

  it("counts Lootbug 10x only when bought or golden (no double count)", () => {
    installPlayerStorage();
    const i = readGemInputs();
    const bought = computeGemSnapshot(i, {});
    const notBought = computeGemSnapshot(i, { lootbugBuy: ["+3 Item Chests"] });
    expect(bought.rates.lootbug10xMinPerHour).toBeCloseTo(3.159, 2);
    expect(notBought.rates.lootbug10xMinPerHour).toBeCloseTo(3.159 * 0.25, 2); // golden 25%
    // the lootbug 10x share is a memo inside the bomb term, never a separate income
    expect(bought.sources.some((x) => /10x/i.test(x.label) && x.kind === "income")).toBe(false);
    expect(bought.memos.find((m) => m.id === "lootbug_10x_in_bombs")!.gemsPerHour).toBeGreaterThan(5);
  });

  it("applies Chaos Totem uptime to bombs and counts chests once", () => {
    const { s, inputs } = snap("early");
    expect(s.rates.chaosTotemUptime).toBeGreaterThan(0.05);
    expect(s.memos.find((m) => m.id === "chaos_in_bombs")!.gemsPerHour).toBeGreaterThan(2);
    // charge magnets cover every chest source (freebie + stonks + lootbug), valued once
    expect(s.rates.chargeMagnetsPerHour).toBeCloseTo(inputs.items.itemsPerChest * s.rates.chestsPerHour * 0.026, 9);
    expect(s.sources.filter((x) => /chest/i.test(x.label)).length).toBe(1);
    const full = computeGemSnapshot(inputs, { bombCycle: "early", chaosTotemFull: true });
    expect(full.netPerHour).toBeGreaterThan(s.netPerHour + 20);
  });

  it("claim cadence and AFK", () => {
    const { s } = snap("early");
    expect(s.claim.freebieBankFillMinutes).toBeCloseTo(67.9, 0); // analysis: 68 min
    expect(s.claim.lootbugBankFillMinutes).toBeCloseTo(54.6, 0); // analysis: 55 min
    expect(s.claim.recommendedClaimEveryMinutes).toBeCloseTo(54.6, 0);
    expect(s.afk.netPerHourAfk).toBeLessThan(0); // everything fueled costs more than it earns away
    expect(s.afk.netPerHourAfkUnfueled).toBeGreaterThan(s.afk.netPerHourAfk);
    expect(s.afk.bankedFreebiesGems).toBeCloseTo(35 * 30.64, -2);
  });
});

describe("inputs", () => {
  it("merges bomb fields from Bombs and the rest from GemEv", () => {
    const m = mergeGemParams(
      { freebie_gems_base: 16, vip_lounge_level: 12, game_speed_multiplier: 2, bomb_cycle: "early", free_bomb_chance: 0.1, jackpot_chance: 0.2 },
      { freebie_gems_base: 9, vip_lounge_level: 3, game_speed_multiplier: 1, bomb_cycle: "late", free_bomb_chance: 0.3 },
    );
    expect(m.freebie_gems_base).toBe(16);
    expect(m.vip_lounge_level).toBe(12);
    expect(m.game_speed_multiplier).toBe(2);
    expect(m.jackpot_chance).toBe(0.2);
    expect(m.bomb_cycle).toBe("late");
    expect(m.free_bomb_chance).toBe(0.3);
    // no Bombs save: GemEv (importer-synced) values stand
    expect(mergeGemParams({ free_bomb_chance: 0.1 }, null).free_bomb_chance).toBe(0.1);
    // Bombs save without a bomb key falls back to GemEv / default
    expect(mergeGemParams({ gem_bomb_gem_chance: 0.04 }, {}).gem_bomb_gem_chance).toBe(0.04);
    expect(BOMB_PARAM_KEYS.length).toBeGreaterThan(15);
  });
  it("uses defaults when nothing is saved", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    const i = readGemInputs();
    expect(i.params).toEqual(defaultGameParameters());
    expect(i.present.gemev).toBe(false);
    expect(computeGemSnapshot(i).netPerHour).toBeGreaterThan(0);
  });
  it("respects the stonks toggle but otherwise the imported chance", () => {
    installPlayerStorage((st) => {
      const k = "obeliskfarm:web:gemev_save.json:v1";
      const g = JSON.parse(st[k]!);
      g.params.stonks_chance = 0.02;
      st[k] = JSON.stringify(g);
    });
    const i = readGemInputs();
    const a = computeGemSnapshot(i);
    const b = computeGemSnapshot({ ...i, stonksEnabled: false });
    expect(src(a, "stonks")).toBeCloseTo(72.4 * 2, 0);
    expect(src(b, "stonks")).toBe(0);
  });
});

describe("levers", () => {
  function levers(cycle: "early" | "late") {
    installPlayerStorage();
    const i = readGemInputs();
    return { i, l: rankGemLevers(i, { bombCycle: cycle }) };
  }
  const get = (l: ReturnType<typeof rankGemLevers>, id: string) => l.find((x) => x.id === id)!;

  it("late cycle beats early for this player", () => {
    const { l } = levers("early");
    const c = get(l, "bomb_cycle");
    expect(c.how).toBe("Bombs → Bomb cycle → Late");
    expect(c.deltaNetPerHour).toBeGreaterThan(60); // analysis: +60.9 app, +86.4 with Frogger; + cherry & magnets here
    expect(l[0]!.kind).not.toBe("purchase"); // free changes first
    expect(get(levers("late").l, "bomb_cycle").deltaNetPerHour).toBeLessThan(0);
  });

  it("fueled Frogger pays only in the late cycle (analysis)", () => {
    const early = get(levers("early").l, "fuel_frogger").deltaNetPerHour; // "stop fueling"
    const late = get(levers("late").l, "fuel_frogger").deltaNetPerHour;
    expect(early).toBeCloseTo(9.5, 0); // analysis: fueled is -9.5/h in early
    expect(late).toBeCloseTo(-64.9, 0); // analysis: +64.9/h when kept fueled in late
  });

  it("Bomb Bear swap loses gems, as in the analysis", () => {
    expect(get(levers("early").l, "swap_frogger_bear").deltaNetPerHour).toBeCloseTo(-37.7, -1);
    expect(get(levers("late").l, "swap_frogger_bear").deltaNetPerHour).toBeLessThan(-90);
  });

  it("purchase deltas match the analysis", () => {
    const { l } = levers("early");
    expect(get(l, "gems_per_roll").deltaNetPerHour).toBeCloseTo(50, 0);
    expect(get(l, "jackpot_1pct").deltaNetPerHour).toBeGreaterThan(20); // 16 gems/roll (analysis: 13.9 at 9)
    expect(get(l, "stonks_multi_0_1").deltaNetPerHour).toBeCloseTo(6.6, 0);
    expect(get(l, "refresh_1pct").deltaNetPerHour).toBeGreaterThan(6.5);
    expect(get(l, "lootbug_buy_10x Bomb Recharge").deltaNetPerHour).toBeCloseTo(21, -1); // stop buying: ~ +22/h
  });

  it("payback uses typed prices only", () => {
    installPlayerStorage();
    const i = readGemInputs();
    const l = rankGemLevers(i, { prices: { gems_per_roll: 1000 } });
    const g = l.find((x) => x.id === "gems_per_roll")!;
    expect(g.costGems).toBe(1000);
    expect(g.paybackHours).toBeCloseTo(1000 / g.deltaNetPerHour, 9);
    expect(l.find((x) => x.id === "jackpot_1pct")!.costGems).toBeNull();
  });
});

describe("planFreeChanges", () => {
  it("applies free changes in sequence without contradicting itself", () => {
    installPlayerStorage();
    const inputs = readGemInputs();
    vi.unstubAllGlobals();
    const plan = planFreeChanges(inputs, { bombCycle: "early" });
    const ids = plan.steps.map((s) => s.id);
    expect(ids[0]).toBe("bomb_cycle");
    // Once the cycle is Late, Frogger's fuel pays for itself, so the plan must not unfuel it.
    expect(ids).not.toContain("fuel_frogger");
    expect(plan.finalOverrides.bombCycle).toBe("late");
    expect(plan.netAfter).toBeGreaterThan(plan.netBefore);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
