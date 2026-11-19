import { beforeEach, describe, expect, it } from "vitest";
import { loadFishInventory, saveFishInventory, FISH_INVENTORY_KEY } from "../inventory";
import { rankPurchases } from "../ranking";
import { nextUpgradeTarget } from "../sushi";
import * as X from "./fixtures";

const PLAYER_COUNTS: Record<string, number> = {};
import { ALL_FISH } from "../constants";
[10009, 3486, 1289, 96, 17721, 9589, 427, 7, 565, 350, 407, 535, 0, 0, 0, 0].forEach((n, i) => {
  if (n > 0) PLAYER_COUNTS[ALL_FISH[i]!.id] = n;
});

describe("fish inventory storage", () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  });
  it("round-trips and drops junk", () => {
    expect(loadFishInventory()).toEqual({ counts: {}, updatedAt: null });
    saveFishInventory({ counts: { guppy: 12.7, nope: 5, bass: -1 }, updatedAt: "2026-01-01T00:00:00.000Z" });
    expect(localStorage.getItem(FISH_INVENTORY_KEY)).toBeTruthy();
    expect(loadFishInventory()).toEqual({ counts: { guppy: 12 }, updatedAt: "2026-01-01T00:00:00.000Z" });
  });
});

describe("rankPurchases with owned fish", () => {
  const state = X.playerState();
  const base = rankPurchases(state, {});
  const firstFish = base.find((p) => p.cost.currency === "fish" && p.hoursToAfford != null && p.hoursToAfford > 0)!;
  const fid = firstFish.cost.fishId!;
  const rate = firstFish.cost.amount / firstFish.hoursToAfford!;

  it("is unchanged without inventory and reports owned 0", () => {
    expect(rankPurchases(state, {}, {})).toEqual(base);
    expect(firstFish.owned).toBe(0);
    expect(firstFish.affordableNow).toBe(false);
  });
  it("owned fish reduce hours by remaining/rate", () => {
    const owned = Math.floor(firstFish.cost.amount * 0.4);
    const r = rankPurchases(state, {}, { ownedFish: { [fid]: owned } }).find((p) => p.id === firstFish.id)!;
    expect(r.owned).toBe(owned);
    expect(r.hoursToAfford).toBeCloseTo((firstFish.cost.amount - owned) / rate, 6);
  });
  it("owned >= cost is affordableNow with 0 hours", () => {
    const r = rankPurchases(state, {}, { ownedFish: { [fid]: firstFish.cost.amount } }).find((p) => p.id === firstFish.id)!;
    expect(r.affordableNow).toBe(true);
    expect(r.hoursToAfford).toBe(0);
    expect(r.hoursIfFocused).toBe(0);
  });
  it("Frostshell 350 of 510 leaves 160 to go", () => {
    const rows = rankPurchases(state, {}, { ownedFish: PLAYER_COUNTS });
    const f = rows.find((p) => p.cost.fishId === "frostshell_crab" && p.hoursToAfford != null && p.cost.amount > 350);
    expect(f).toBeDefined();
    expect(f!.owned).toBe(350);
    const f2 = f!;
    const b = base.find((p) => p.id === f2.id)!;
    if (b.hoursToAfford) expect(f2.hoursToAfford).toBeCloseTo(((f2.cost.amount - 350) / f2.cost.amount) * b.hoursToAfford, 6);
  });
  it("sushi target coverage uses remaining", () => {
    const t = nextUpgradeTarget(rankPurchases(state, {}, { ownedFish: { [fid]: 10 } }))!;
    expect(t.remaining).toBe(Math.max(0, t.amount - t.owned));
  });
});
