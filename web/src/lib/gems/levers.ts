/**
 * Gem levers: every candidate change is evaluated by FULL recomputation (computeGemSnapshot) because the bomb refill
 * recursion, 10x overlap and Chaos Totem make the model non-linear. deltaNetPerHour = net(after) - net(before).
 * Costs are mostly unknown: `costGems` is the price the player typed (GemOverrides.prices[id]) or null.
 */
import type { GemInputs, GemOverrides } from "./inputs";
import { applyDroneOverrides, buildEffectiveParams, computeGemSnapshot } from "./model";
import { droneDef, type DroneId } from "../drone/model";
import type { GameParameters } from "../gemev/freebieEv";

export type GemLeverKind = "setting" | "purchase" | "drone" | "lootbug";

export type GemLever = {
  id: string;
  label: string;
  kind: GemLeverKind;
  deltaNetPerHour: number;
  /** Plain-English instruction, e.g. "Bombs → Bomb cycle → Late". */
  how: string;
  /** Gem price if the player entered one (GemOverrides.prices[id]); null = unknown. */
  costGems?: number | null;
  /** costGems / deltaNetPerHour when both known and delta > 0. */
  paybackHours?: number | null;
  note?: string;
  /**
   * Present when the lever is purely a page what-if (bomb cycle, drone fuel/swap, Lootbug buys, Chaos 100%).
   * Applies the same change the ranking measured to a given overrides object.
   */
  whatIf?: (o: GemOverrides) => GemOverrides;
};

type Mod = { inputs: GemInputs; overrides: GemOverrides };
type Candidate = { id: string; label: string; kind: GemLeverKind; how: string; note?: string; apply: (m: Mod, p: GameParameters) => Mod | null; overrideOnly?: boolean };

const CARD_NAMES = ["none", "Card", "Gilded", "Polychrome"];
const GEM_BUFF_LEVERS: { name: string; short: string }[] = [
  { name: "10x Bomb Recharge", short: "10x Bomb Recharge" },
  { name: "+100 Cherry Charges", short: "+100 Cherry Charges" },
  { name: "+3 Item Chests", short: "+3 Item Chests" },
];
const GEM_VALUED_DRONES: DroneId[] = ["elixir", "frogger", "bear"];
const SWAP_TRIO: DroneId[] = ["frogger", "bear", "angler"];

function withParams(m: Mod, patch: Partial<GameParameters>): Mod {
  return { inputs: { ...m.inputs, params: { ...m.inputs.params, ...patch } }, overrides: m.overrides };
}
function withOverrides(m: Mod, patch: Partial<GemOverrides>): Mod {
  return { inputs: m.inputs, overrides: { ...m.overrides, ...patch } };
}

function candidates(base: Mod): Candidate[] {
  const P = buildEffectiveParams(base.inputs, base.overrides);
  const drone = applyDroneOverrides(base.inputs.drone, base.overrides);
  const out: Candidate[] = [];

  // --- free settings
  const otherCycle = P.bomb_cycle === "late" ? "early" : "late";
  out.push({
    id: "bomb_cycle",
    label: `Bomb cycle: ${otherCycle}`,
    kind: "setting",
    how: `Bombs → Bomb cycle → ${otherCycle === "late" ? "Late" : "Early"}`,
    note: otherCycle === "late" ? "Late: Cherry → Gem → Battery → D20 (cherry 3x bonus counts as gem-bomb clicks)." : "Early: Cherry → Battery → D20 → Gem.",
    apply: (m) => withOverrides(m, { bombCycle: otherCycle }),
      overrideOnly: true,
  });

  // --- drone fuel toggles (only drones whose benefit the model values)
  for (const id of GEM_VALUED_DRONES) {
    const def = droneDef(id);
    if (!drone[def.on]) continue;
    const fueled = Boolean(drone[def.fueled]);
    out.push({
      id: `fuel_${id}`,
      label: `${def.label}: ${fueled ? "stop fueling" : "fuel it"}`,
      kind: "drone",
      how: `Drone → ${def.label} → ${fueled ? "uncheck Fueled" : "check Fueled"}`,
      note: id === "elixir" ? "Elixir's 2x Game Speed buff is not valued, so this understates keeping it fueled." : id === "frogger" ? "Frogger only pays for its fuel with the late bomb cycle (unfueled it fires 1 bomb per autofire)." : undefined,
      apply: (m) => withOverrides(m, { droneFuel: { ...m.overrides.droneFuel, [id]: !fueled } }),
      overrideOnly: true,
    });
  }
  // --- swaps among Frogger / Bomb Bear / Angler
  for (const from of SWAP_TRIO) {
    if (!drone[droneDef(from).on]) continue;
    for (const to of SWAP_TRIO) {
      if (to === from || drone[droneDef(to).on]) continue;
      out.push({
        id: `swap_${from}_${to}`,
        label: `Swap ${droneDef(from).label} → ${droneDef(to).label}`,
        kind: "drone",
        how: `Drone → unequip ${droneDef(from).label}, equip and fuel ${droneDef(to).label}`,
        note: to === "angler" ? "Angler gives fishing ticks, not gems; its fuel is a non-gem cost and is not counted here." : to === "bear" ? "Bomb Bear raises Lootbug spawn rate." : undefined,
        apply: (m) =>
          withOverrides(m, {
            droneOn: { ...m.overrides.droneOn, [from]: false, [to]: true },
            droneFuel: { ...m.overrides.droneFuel, [to]: true },
          }),
        overrideOnly: true,
      });
    }
  }

  // --- lootbug gem buff purchases
  const buying = new Set(base.overrides.lootbugBuy ?? base.inputs.lootbug.activeGemBuffs);
  for (const b of GEM_BUFF_LEVERS) {
    const has = buying.has(b.name);
    out.push({
      id: `lootbug_buy_${b.name}`,
      label: `Lootbug: ${has ? "stop buying" : "buy"} ${b.short}`,
      kind: "lootbug",
      how: `Lootbug → Gem buffs → ${has ? "uncheck" : "check"} ${b.name}`,
      note: "Net of the gem cost (golden procs are free).",
      apply: (m) => {
        const cur = new Set(m.overrides.lootbugBuy ?? m.inputs.lootbug.activeGemBuffs);
        if (has) cur.delete(b.name);
        else cur.add(b.name);
        return withOverrides(m, { lootbugBuy: [...cur] });
      },
      overrideOnly: true,
    });
  }

  // --- purchases / upgrades
  const cardKeys: { key: keyof GameParameters; name: string }[] = [
    { key: "gem_bomb_recharge_card_level", name: "Gem bomb" },
    { key: "cherry_bomb_recharge_card_level", name: "Cherry bomb" },
    { key: "battery_bomb_recharge_card_level", name: "Battery bomb" },
    { key: "d20_bomb_recharge_card_level", name: "D20 bomb" },
  ];
  for (const c of cardKeys) {
    const lvl = Number(P[c.key] ?? 0);
    if (lvl >= 3) continue;
    out.push({
      id: `card_${String(c.key)}`,
      label: `${c.name} recharge card → ${CARD_NAMES[lvl + 1]}`,
      kind: "purchase",
      how: `Bombs → ${c.name} recharge card → ${CARD_NAMES[lvl + 1]}`,
      apply: (m) => withParams(m, { [c.key]: lvl + 1 } as Partial<GameParameters>),
    });
  }
  out.push({
    id: "gems_per_roll",
    label: "+1 gem per freebie roll",
    kind: "purchase",
    how: "Upgrade: Freebie gems (+1 per roll)",
    apply: (m) => withOverrides(m, { gemsPerFreebieRoll: P.freebie_gems_base + 1 }),
  });
  out.push({
    id: "freebie_timer_10s",
    label: "Freebie timer −10 s",
    kind: "purchase",
    how: "Upgrade: Freebie timer (−10 s total)",
    apply: (m) => withParams(m, { freebie_timer_upgrade_level: Math.trunc(P.freebie_timer_upgrade_level ?? 0) + 10 }),
  });
  out.push({
    id: "refresh_1pct",
    label: "+1% instant refresh",
    kind: "purchase",
    how: "Upgrade: Instant refresh chance (+1%)",
    apply: (m) => withParams(m, { instant_refresh_chance: Math.min(0.99, P.instant_refresh_chance + 0.01) }),
  });
  out.push({
    id: "jackpot_1pct",
    label: "+1% jackpot (5x freebie)",
    kind: "purchase",
    how: "Upgrade: 5x freebie chance (+1%)",
    apply: (m) => withParams(m, { jackpot_chance: Math.min(1, P.jackpot_chance + 0.01) }),
  });
  out.push({
    id: "stonks_multi_0_1",
    label: "+0.1 Stonks multiplier",
    kind: "purchase",
    how: "Upgrade: Stonks multiplier (+0.1)",
    apply: (m) => withParams(m, { stonks_multiplier: P.stonks_multiplier + 0.1 }),
  });
  out.push({
    id: "free_bomb_1pct",
    label: "+1% free bomb chance",
    kind: "purchase",
    how: "Upgrade: Free bomb chance (+1%)",
    apply: (m) => withParams(m, { free_bomb_chance: Math.min(0.99, P.free_bomb_chance + 0.01) }),
  });
  out.push({
    id: "gem_chance_1pt",
    label: "+1 point gem bomb chance",
    kind: "purchase",
    how: "Upgrade: Gem bomb gem chance (+1 percentage point)",
    apply: (m) => withParams(m, { gem_bomb_gem_chance: Math.min(1, P.gem_bomb_gem_chance + 0.01) }),
  });
  if (!P.has_golden_gem_bomb) {
    out.push({
      id: "golden_gem_bomb",
      label: "Golden Gem Bomb (x1.25 gem chance)",
      kind: "purchase",
      how: "Fish card tribute: Golden Gem Bomb, then tick it in Bombs",
      apply: (m) => withParams(m, { has_golden_gem_bomb: true }),
    });
  }
  if (!base.inputs.chaosTotem100Uptime && !base.overrides.chaosTotemFull) {
    out.push({
      id: "chaos_totem_100",
      label: "Chaos Totem at 100% uptime",
      kind: "purchase",
      how: "Items: more Chaos Totems / longer duration until uptime is 100%",
      note: "Upper bound; needs far more totems than your chests give.",
      apply: (m) => withOverrides(m, { chaosTotemFull: true }),
      overrideOnly: true,
    });
  }
  return out;
}

/** Rank gem levers by full recomputation. Free changes (settings, drones, lootbug) first, then purchases; each group by delta. */
export function rankGemLevers(inputs: GemInputs, overrides: GemOverrides = {}): GemLever[] {
  const base: Mod = { inputs, overrides };
  const baseNet = computeGemSnapshot(inputs, overrides).netPerHour;
  const levers: GemLever[] = [];
  for (const c of candidates(base)) {
    const m = c.apply(base, buildEffectiveParams(inputs, overrides));
    if (!m) continue;
    const delta = computeGemSnapshot(m.inputs, m.overrides).netPerHour - baseNet;
    const cost = overrides.prices?.[c.id];
    const costGems = typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null;
    levers.push({
      id: c.id,
      label: c.label,
      kind: c.kind,
      deltaNetPerHour: delta,
      how: c.how,
      costGems,
      paybackHours: costGems != null && delta > 1e-9 ? costGems / delta : null,
      note: c.note,
      whatIf: c.overrideOnly
        ? (o: GemOverrides) => c.apply({ inputs, overrides: o }, buildEffectiveParams(inputs, o))?.overrides ?? o
        : undefined,
    });
  }
  const free = (k: GemLeverKind) => k !== "purchase";
  return levers.sort((a, b) => {
    const fa = free(a.kind) ? 0 : 1;
    const fb = free(b.kind) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return b.deltaNetPerHour - a.deltaNetPerHour;
  });
}

export type PlannedChange = { id: string; label: string; how: string; deltaNetPerHour: number };

/**
 * Free changes applied one after another: pick the best free what-if, apply it, re-rank, repeat.
 * Sequential so the list never contradicts itself (e.g. Frogger fuel only pays once the cycle is Late).
 * Drone swaps are left out: they trade gems for other resources (fishing ticks, lootbugs) the model doesn't value.
 */
export function planFreeChanges(
  inputs: GemInputs,
  overrides: GemOverrides = {},
  maxSteps = 8,
): { steps: PlannedChange[]; finalOverrides: GemOverrides; netBefore: number; netAfter: number } {
  const netBefore = computeGemSnapshot(inputs, overrides).netPerHour;
  let cur = overrides;
  const steps: PlannedChange[] = [];
  const done = new Set<string>();
  for (let i = 0; i < maxSteps; i++) {
    const next = rankGemLevers(inputs, cur).find(
      (l) => l.kind !== "purchase" && l.whatIf && !l.id.startsWith("swap_") && !done.has(l.id) && l.deltaNetPerHour > 0.5,
    );
    if (!next || !next.whatIf) break;
    done.add(next.id);
    steps.push({ id: next.id, label: next.label, how: next.how, deltaNetPerHour: next.deltaNetPerHour });
    cur = next.whatIf(cur);
  }
  return { steps, finalOverrides: cur, netBefore, netAfter: computeGemSnapshot(inputs, cur).netPerHour };
}
