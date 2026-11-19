/**
 * Pure Sushi math for the new Fishing page.
 * Classic reference (modules/fishing/Fishing.tsx): ticks per Sushi = SUSHI_BASE_TICKS + SUSHI_CARD_TICKS[card]
 * (line ~1476) + workshopSushiTicksWorld3 (display line ~3185). Fish per Sushi = ticks * fishPerHour / rawTicksPerHour
 * (line ~1480). In the snapshot, fillsPerHour = rawTicksPerHour / ticksNeeded, so that equals
 * (ticks / ticksNeeded) fills * (fishPerHour / fillsPerHour) fish per fill; the per-fill expectation already
 * includes double/triple/5x tick rolls, shiny, income and card multipliers.
 * Sushi ticks are raw ticks: Elixir 3x (shortens tick time) and Gift 5x buff (non-sushi ticks only, classic line ~930)
 * do not change what a Sushi yields; the double/triple/5x tick CHANCE stats do (through expectedRolls).
 */
import { SUSHI_BASE_TICKS, SUSHI_CARD_TICKS } from "./model";
import type { DockSnapshot } from "./model";
import type { FishCardTier } from "./state";
import { fishTrack, type RankedPurchase } from "./ranking";

export function ticksPerSushi(cardTier: FishCardTier, workshopTicks = 0): number {
  return SUSHI_BASE_TICKS + SUSHI_CARD_TICKS[cardTier] + Math.max(0, workshopTicks);
}

export type SushiYield = { totalFish: number; perFish: Record<string, number>; fills: Record<string, number> };

/** Expected fish from `ticks` raw ticks with the docks as in `docks` (ticks go to every fished dock). */
export function sushiYield(docks: DockSnapshot[], ticks: number): SushiYield {
  const perFish: Record<string, number> = {};
  const fills: Record<string, number> = {};
  let totalFish = 0;
  if (!(ticks > 0)) return { totalFish, perFish, fills };
  for (const d of docks) {
    if (!d.unlocked || d.fishPerHour <= 0 || d.ticksNeeded <= 0 || d.fillsPerHour <= 0) continue;
    const f = ticks / d.ticksNeeded;
    fills[d.dockId] = f;
    for (const fish of d.fish) {
      const n = f * (fish.perHour / d.fillsPerHour);
      perFish[fish.fishId] = n;
      totalFish += n;
    }
  }
  return { totalFish, perFish, fills };
}

export type NextUpgradeTarget = {
  purchase: RankedPurchase;
  fishId: string;
  /** Full cost of the upgrade. */
  amount: number;
  /** Fish of that kind already owned. */
  owned: number;
  /** Still missing: max(0, amount - owned). Sushi coverage is measured against this. */
  remaining: number;
  label: string;
};

/** Top fish-track purchase that costs a specific fish. */
export function nextUpgradeTarget(ranked: RankedPurchase[]): NextUpgradeTarget | null {
  const p = fishTrack([...ranked]).find((x) => x.cost.currency === "fish" && !!x.cost.fishId);
  if (!p) return null;
  const owned = Math.max(0, p.owned ?? 0);
  return { purchase: p, fishId: p.cost.fishId!, amount: p.cost.amount, owned, remaining: Math.max(0, p.cost.amount - owned), label: `${p.name} L${p.toLevel}` };
}

/** Fraction (can exceed 1) of the target's cost covered by the fish. */
export function coverage(fish: number, amount: number): number {
  return amount > 0 ? fish / amount : 0;
}

export type SushiAdvice = { text: string; reason: string };

export function sushiAdvice(opts: { hasTarget: boolean; currentFarmsTarget: boolean; currentTargetFish: number; bestTargetFish: number }): SushiAdvice {
  if (!opts.hasTarget) return { text: "Use it whenever you like.", reason: "No fish-priced upgrade is queued, so any placement is as good as another." };
  if (opts.currentFarmsTarget)
    return { text: "Use it now.", reason: "Your drones and rod already farm the next upgrade's fish." };
  if (opts.bestTargetFish > opts.currentTargetFish)
    return { text: "Move drones first (Best for next upgrade), then use it.", reason: "Right now it would mostly catch fish the next upgrade does not need." };
  return { text: "Use it now.", reason: "Moving drones would not catch more of the needed fish." };
}
