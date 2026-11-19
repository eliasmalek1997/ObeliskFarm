/**
 * "What should I buy next?" ranking across every Fishing purchase type (fish upgrades, gem enhancements,
 * skill-tree levels, fish card gilds). Pure; built on the same engine as {@link computeFishingSnapshot}.
 *
 * Method
 * - Gain % of a purchase = change of total fish/h when the rod and all drones sit on one reference dock
 *   (the highest unlocked dock). Power-like and multiplier-like upgrades give the same % on any dock, so this basis is
 *   stable. Fish card gilds are measured on their own dock (`basis: "fish-dock"`).
 * - Structural purchases (Upgrade Boat, Upgrade Tier 2 Boat) do not change fish/h themselves. They are valued by
 *   lookahead: own effect at the best dock placement + the best newly unlocked fish upgrades (see `unlocks`).
 * - Cost in hours: fish costs use the per-fish rate of your CURRENT dock assignment (`hoursToAfford`, null when you do not
 *   farm that fish right now) and the rate if you moved everything to that fish's dock (`hoursIfFocused`).
 *   Gem costs use `ctx.gemsPerHour` (null when unknown).
 */

import { computeFishingStatsFromLevels } from "./computeStats";
import {
  AQUARIUM,
  DOCKS,
  ENHANCEMENTS_T1,
  ENHANCEMENTS_T2,
  FISHING_ROD_GILD_CARD_COST,
  FISHING_UPGRADES_T1,
  FISHING_UPGRADES_T2,
  getFishCardGildGemCost,
} from "./constants";
import { ENHANCE_COSTS_T1, ENHANCE_COSTS_T2, UPGRADE_COSTS } from "./upgradeCosts";
import { FISHING_SKILL_TREE } from "./skillTree";
import {
  GEMS_PER_SKILL_POINT,
  buildTotalFishOptions,
  computeConcentratedFishPerHour,
  computeFishingSnapshot,
  fishRateWhenFocused,
  getDockIdForFish,
  getTopUnlockedDockId,
  getUnlockedDockIds,
  suggestDronePlacement,
  type FishingContext,
} from "./model";
import type { FishingState } from "./state";
import type { DockId, EnhanceId, FishingSkillId, FishingUpgradeId } from "./types";

export type PurchaseKind = "upgrade" | "enhancement" | "skill" | "fishCard";

export type PurchaseCost = {
  currency: "fish" | "gems" | "skillPoints";
  /** Fish id when `currency` is "fish". */
  fishId?: string;
  amount: number;
};

export type RankedPurchase = {
  kind: PurchaseKind;
  /**
   * Upgrade id, enhancement id, skill id, or fish id for fish cards ("fishing_rod_card" for the Fishing Rod card).
   */
  id: string;
  name: string;
  fromLevel: number;
  toLevel: number;
  cost: PurchaseCost;
  /**
   * Hours to earn the cost: fish = amount / current fish/h of that fish (null if you do not farm it now),
   * gems / skill points = gems / ctx.gemsPerHour (null if unknown). Skill points are converted at 125 gems each.
   */
  hoursToAfford: number | null;
  /** Fish costs only: hours if the rod and all drones were moved to the cost fish's dock (null if that dock is locked). */
  hoursIfFocused: number | null;
  /** Gain of total fish/h in percent (>= 0 for structural purchases, includes lookahead value). */
  gainPct: number;
  /** gainPct / hoursToAfford (structural: hours include the newly unlocked purchases). null when hoursToAfford is null. */
  gainPctPerHour: number | null;
  /** gainPct / hoursIfFocused (fish costs only). */
  gainPctPerHourFocused: number | null;
  /** gem / skill-point costs only: gainPct per 1000 gems (skill points x125). */
  gainPctPerKGem: number | null;
  /** Names of things this purchase unlocks (boats), with their own gain. */
  unlocks?: string[];
  /** Human-readable caveat, e.g. "Move a drone to Tundra to farm this." */
  note?: string;
  /** True for Upgrade Boat / Upgrade Tier 2 Boat (value comes from what they unlock). */
  structural?: boolean;
  /** What the gain % was measured on. */
  basis: "top-dock" | "fish-dock";
};

const UNLOCK_LOOKAHEAD_COUNT = 3;
const STRUCTURAL_IDS = new Set<string>(["upgrade_boat", "upgrade_t2_boat"]);

const DOCK_NAME = new Map(DOCKS.map((d) => [d.id, d.name]));

function withUpgrade(state: FishingState, id: FishingUpgradeId, level: number): FishingState {
  return { ...state, upgradeLevels: { ...state.upgradeLevels, [id]: level } };
}
function withEnhance(state: FishingState, id: EnhanceId, level: number): FishingState {
  return { ...state, enhanceLevels: { ...state.enhanceLevels, [id]: level } };
}
function withSkill(state: FishingState, id: FishingSkillId, level: number): FishingState {
  return { ...state, skillTreeLevels: { ...state.skillTreeLevels, [id]: level } };
}

function pct(next: number, base: number): number {
  return base > 0 ? ((next - base) / base) * 100 : 0;
}

type UpgradeDefLike = { id: FishingUpgradeId; name: string; boatLevelRequired: number; t2BoatLevelRequired: number | null };
type EnhanceDefLike = { id: EnhanceId; name: string; boatLevelRequired: number; t2BoatLevelRequired: number | null };

const ALL_UPGRADE_DEFS: UpgradeDefLike[] = [...FISHING_UPGRADES_T1, ...FISHING_UPGRADES_T2];
const ALL_ENHANCE_DEFS: EnhanceDefLike[] = [...ENHANCEMENTS_T1, ...ENHANCEMENTS_T2];

function enhanceCosts(id: EnhanceId) {
  return ENHANCE_COSTS_T1[id as keyof typeof ENHANCE_COSTS_T1] ?? ENHANCE_COSTS_T2[id as keyof typeof ENHANCE_COSTS_T2];
}

function isAvailable(def: { boatLevelRequired: number; t2BoatLevelRequired: number | null }, boat: number, t2: number): boolean {
  return boat >= def.boatLevelRequired && (def.t2BoatLevelRequired == null || t2 >= def.t2BoatLevelRequired);
}

function boatLevels(state: FishingState): { boat: number; t2: number } {
  const s = computeFishingStatsFromLevels(state.upgradeLevels ?? {}, state.enhanceLevels ?? {}, buildTotalFishOptions(state));
  return { boat: s.boat_level, t2: s.t2_boat_level ?? 0 };
}

function fishCostFarmNote(fishId: string, unlockedDocks: DockId[]): string {
  const dockId = getDockIdForFish(fishId);
  const dockName = dockId ? DOCK_NAME.get(dockId) : undefined;
  if (dockId && !unlockedDocks.includes(dockId)) return `${dockName ?? "That"} dock is locked: upgrade the boat first.`;
  return `Move a drone to ${dockName ?? "its dock"} to farm this.`;
}

/** Evaluate one fish upgrade level (+1). `lookahead` adds the unlock valuation for structural upgrades. */
function evalUpgrade(
  state: FishingState,
  ctx: FishingContext,
  def: UpgradeDefLike,
  refDock: DockId,
  baseTotal: number,
  rates: Record<string, number>,
  lookahead: boolean,
): RankedPurchase | null {
  const costs = UPGRADE_COSTS[def.id];
  if (!costs?.length) return null;
  const maxLvl = costs[costs.length - 1]!.level;
  const lvl = Math.max(0, Math.min(maxLvl, Math.floor(state.upgradeLevels?.[def.id] ?? 0)));
  if (lvl >= maxLvl) return null;
  const entry = costs.find((c) => c.level === lvl + 1);
  if (!entry) return null;
  const next = withUpgrade(state, def.id, lvl + 1);
  const structural = STRUCTURAL_IDS.has(def.id);

  let gainPct = pct(computeConcentratedFishPerHour(next, ctx, refDock), baseTotal);
  let unlocks: string[] | undefined;
  let extraHours = 0;
  let note: string | undefined;

  if (structural) {
    // Own effect at the best placement (never negative: a new dock is only an extra option).
    const bestBase = suggestDronePlacement(state, ctx, { kind: "max-fish" }).totalFishPerHour;
    const bestNext = suggestDronePlacement(next, ctx, { kind: "max-fish" }).totalFishPerHour;
    gainPct = Math.max(0, gainPct, pct(bestNext, bestBase));
    if (lookahead) {
      const la = unlockLookahead(state, next, ctx);
      gainPct += la.gainPct;
      extraHours = la.hours;
      unlocks = la.names;
      note = la.names.length
        ? "Value = own effect + best newly unlocked purchases (listed in unlocks)."
        : "Nothing new to buy right away; unlocks a dock.";
    }
  }

  const rate = rates[entry.fishId] ?? 0;
  const ownHours = rate > 0 ? entry.amount / rate : null;
  const focusRate = fishRateWhenFocused(state, ctx, entry.fishId);
  const hoursIfFocused = focusRate > 0 ? entry.amount / focusRate : null;
  const bl = boatLevels(state);
  const unlockedDocks = getUnlockedDockIds(bl.boat, bl.t2);
  if (ownHours == null) {
    const farm = fishCostFarmNote(entry.fishId, unlockedDocks);
    note = note ? `${note} ${farm}` : farm;
  }
  const hoursToAfford = ownHours;
  return {
    kind: "upgrade",
    id: def.id,
    name: def.name,
    fromLevel: lvl,
    toLevel: lvl + 1,
    cost: { currency: "fish", fishId: entry.fishId, amount: entry.amount },
    hoursToAfford,
    hoursIfFocused,
    gainPct,
    gainPctPerHour: hoursToAfford != null && hoursToAfford + extraHours > 0 ? gainPct / (hoursToAfford + extraHours) : null,
    gainPctPerHourFocused: hoursIfFocused != null && hoursIfFocused + extraHours > 0 ? gainPct / (hoursIfFocused + extraHours) : null,
    gainPctPerKGem: null,
    unlocks,
    note,
    structural: structural || undefined,
    basis: "top-dock",
  };
}

/**
 * Value of what a structural purchase unlocks: among fish upgrades that become available in `next` (not available in `state`),
 * the best few by gain per farming hour (hours measured with everything focused on the cost fish's dock).
 * Also lists newly available enhancements (their gem cost is a separate currency, so they are named but not summed).
 */
function unlockLookahead(
  state: FishingState,
  next: FishingState,
  ctx: FishingContext,
): { gainPct: number; hours: number; names: string[] } {
  const before = boatLevels(state);
  const after = boatLevels(next);
  const refNext = getTopUnlockedDockId(next);
  const baseNext = computeConcentratedFishPerHour(next, ctx, refNext);
  const ratesNext = computeFishingSnapshot(next, ctx).fishRates;

  const found: { name: string; gainPct: number; hours: number }[] = [];
  for (const def of ALL_UPGRADE_DEFS) {
    if (STRUCTURAL_IDS.has(def.id)) continue;
    if (isAvailable(def, before.boat, before.t2) || !isAvailable(def, after.boat, after.t2)) continue;
    const r = evalUpgrade(next, ctx, def, refNext, baseNext, ratesNext, false);
    if (!r || r.gainPct <= 0) continue;
    const hours = r.hoursIfFocused ?? r.hoursToAfford;
    if (hours == null || hours <= 0) continue;
    found.push({ name: `${def.name} L${r.toLevel} (+${r.gainPct.toFixed(2)}%)`, gainPct: r.gainPct, hours });
  }
  found.sort((a, b) => b.gainPct / b.hours - a.gainPct / a.hours);
  const top = found.slice(0, UNLOCK_LOOKAHEAD_COUNT);

  const names = top.map((t) => t.name);
  for (const def of ALL_ENHANCE_DEFS) {
    if (isAvailable(def, before.boat, before.t2) || !isAvailable(def, after.boat, after.t2)) continue;
    names.push(`${def.name} (enhancement)`);
  }
  for (const def of ALL_UPGRADE_DEFS) {
    if (!STRUCTURAL_IDS.has(def.id)) continue;
    if (isAvailable(def, before.boat, before.t2) || !isAvailable(def, after.boat, after.t2)) continue;
    names.push(def.name);
  }
  return {
    gainPct: top.reduce((a, t) => a + t.gainPct, 0),
    hours: top.reduce((a, t) => a + t.hours, 0),
    names,
  };
}

function gemRanked(
  kind: PurchaseKind,
  id: string,
  name: string,
  fromLevel: number,
  cost: PurchaseCost,
  gainPct: number,
  ctx: FishingContext,
  basis: RankedPurchase["basis"],
  note?: string,
): RankedPurchase {
  const gems = cost.currency === "skillPoints" ? cost.amount * GEMS_PER_SKILL_POINT : cost.amount;
  const gph = ctx.gemsPerHour ?? 0;
  const hours = gph > 0 && gems > 0 ? gems / gph : null;
  return {
    kind,
    id,
    name,
    fromLevel,
    toLevel: fromLevel + 1,
    cost,
    hoursToAfford: hours,
    hoursIfFocused: null,
    gainPct,
    gainPctPerHour: hours != null && hours > 0 ? gainPct / hours : null,
    gainPctPerHourFocused: null,
    gainPctPerKGem: gems > 0 ? (gainPct / gems) * 1000 : null,
    note: hours == null && gph <= 0 ? [note, "Gems per hour unknown (open Gem EV to sync)."].filter(Boolean).join(" ") : note,
    basis,
  };
}

/**
 * Every purchase available right now with its gain and cost. Returned sorted by gain (descending), which is not comparable across currencies;
 * use {@link fishTrack} / {@link gemTrack} to order by efficiency per currency.
 *
 * Nothing is silently dropped: purchases whose cost fish you do not currently farm are returned with
 * `hoursToAfford: null` and a `note`; purchases already at max level are omitted.
 */
export function rankPurchases(state: FishingState, ctx: FishingContext = {}): RankedPurchase[] {
  const out: RankedPurchase[] = [];
  const { boat, t2 } = boatLevels(state);
  const refDock = getTopUnlockedDockId(state);
  const baseTotal = computeConcentratedFishPerHour(state, ctx, refDock);
  const snapshot = computeFishingSnapshot(state, ctx);

  // Fish upgrades
  for (const def of ALL_UPGRADE_DEFS) {
    if (!isAvailable(def, boat, t2)) continue;
    const r = evalUpgrade(state, ctx, def, refDock, baseTotal, snapshot.fishRates, true);
    if (r) out.push(r);
  }

  // Gem enhancements
  for (const def of ALL_ENHANCE_DEFS) {
    if (!isAvailable(def, boat, t2)) continue;
    const costs = enhanceCosts(def.id);
    if (!costs?.length) continue;
    const maxLvl = costs[costs.length - 1]!.level;
    const lvl = Math.max(0, Math.min(maxLvl, Math.floor(state.enhanceLevels?.[def.id] ?? 0)));
    if (lvl >= maxLvl) continue;
    const entry = costs.find((c) => c.level === lvl + 1);
    if (!entry) continue;
    const gain = pct(computeConcentratedFishPerHour(withEnhance(state, def.id, lvl + 1), ctx, refDock), baseTotal);
    const indirect = def.id === "enhance_token_multiplier" || def.id === "enhance_tiny_notice_chance";
    out.push(
      gemRanked(
        "enhancement",
        def.id,
        def.name,
        lvl,
        { currency: "gems", amount: entry.gems },
        gain,
        ctx,
        "top-dock",
        indirect ? "Benefit is not fish/h (tokens / notices), so gain shows 0." : undefined,
      ),
    );
  }

  // Skill tree
  for (const def of FISHING_SKILL_TREE) {
    const maxLvl = def.costs.length;
    const lvl = Math.max(0, Math.min(maxLvl, Math.floor(state.skillTreeLevels?.[def.id] ?? 0)));
    if (lvl >= maxLvl) continue;
    const sp = def.costs[lvl] ?? 0;
    const gain = pct(computeConcentratedFishPerHour(withSkill(state, def.id, lvl + 1), ctx, refDock), baseTotal);
    out.push(
      gemRanked(
        "skill",
        def.id,
        def.name,
        lvl,
        { currency: "skillPoints", amount: sp },
        gain,
        ctx,
        "top-dock",
        def.id === "friendship_ended_tier1" ? "Mostly a notice benefit, not fish/h." : "Obelisk level requirement not checked.",
      ),
    );
  }

  // Fish cards: Card -> Gilded (gain measured on the fish's own dock)
  const unlocked = new Set(getUnlockedDockIds(boat, t2));
  for (const set of AQUARIUM) {
    if (!unlocked.has(set.dockId)) continue;
    const dockBase = computeConcentratedFishPerHour(state, ctx, set.dockId);
    for (const f of set.fish) {
      if ((state.fishCardTier?.[f.id] ?? 0) !== 1) continue;
      const next: FishingState = { ...state, fishCardTier: { ...state.fishCardTier, [f.id]: 2 } };
      const gain = pct(computeConcentratedFishPerHour(next, ctx, set.dockId), dockBase);
      out.push(
        gemRanked(
          "fishCard",
          f.id,
          `${f.name} card: Gild`,
          1,
          { currency: "gems", amount: getFishCardGildGemCost(f.id) },
          gain,
          ctx,
          "fish-dock",
          `Gain assumes the rod and all drones are on ${DOCK_NAME.get(set.dockId)}.`,
        ),
      );
    }
  }
  // Fishing Rod card: Card -> Gilded
  if ((state.fishingRodCardTier ?? 0) === 1) {
    const next: FishingState = { ...state, fishingRodCardTier: 2 };
    const gain = pct(computeConcentratedFishPerHour(next, ctx, refDock), baseTotal);
    out.push(
      gemRanked(
        "fishCard",
        "fishing_rod_card",
        "Fishing Rod card: Gild",
        1,
        { currency: "gems", amount: FISHING_ROD_GILD_CARD_COST },
        gain,
        ctx,
        "top-dock",
      ),
    );
  }

  return out.sort((a, b) => b.gainPct - a.gainPct);
}

/**
 * Fish-currency purchases sorted best first by gain per farming hour. Uses `gainPctPerHour` (your current dock assignment)
 * and falls back to `gainPctPerHourFocused` for purchases whose cost fish you do not farm right now, so they are not buried.
 * Purchases with no known farming time (locked dock) come last, ordered by gain.
 */
export function fishTrack(purchases: RankedPurchase[]): RankedPurchase[] {
  const key = (p: RankedPurchase): number => p.gainPctPerHour ?? p.gainPctPerHourFocused ?? -1;
  return purchases
    .filter((p) => p.cost.currency === "fish")
    .sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka < 0 && kb < 0) return b.gainPct - a.gainPct;
      return kb - ka;
    });
}

/**
 * Gem-priced purchases (enhancements, fish card gilds, skill points at 125 gems each) sorted best first.
 * With `gemsPerHour > 0` sorts by gain per hour of earning gems, otherwise by gain per 1000 gems
 * (both orders are identical except for ties, since hours are proportional to gems).
 */
export function gemTrack(purchases: RankedPurchase[], gemsPerHour = 0): RankedPurchase[] {
  const key = (p: RankedPurchase): number =>
    gemsPerHour > 0 && p.cost.amount > 0
      ? p.gainPct / (((p.cost.currency === "skillPoints" ? GEMS_PER_SKILL_POINT : 1) * p.cost.amount) / gemsPerHour)
      : (p.gainPctPerKGem ?? -1);
  return purchases.filter((p) => p.cost.currency !== "fish").sort((a, b) => key(b) - key(a));
}
