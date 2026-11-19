import { afterEach, describe, expect, it, vi } from "vitest";
import { FISHING_STORAGE_KEY, getDefaultFishingState, loadFishingState, saveFishingState } from "../state";

function stubStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe("fishing state persistence", () => {
  it("keeps the storage key", () => {
    expect(FISHING_STORAGE_KEY).toBe("obeliskfarm:web:fishing_save.json:v1");
  });
  it("returns defaults when nothing is stored", () => {
    stubStorage();
    expect(loadFishingState()).toEqual(getDefaultFishingState());
  });
  it("round-trips and merges partial / old saves with defaults and clamps", () => {
    const store = stubStorage({
      [FISHING_STORAGE_KEY]: JSON.stringify({ upgradeLevels: { fishing_rod: 12 }, mcRuns: 5, mrNibblesQuestRank: 2, sushiCardTier: 9 }),
    });
    const s = loadFishingState();
    expect(s.upgradeLevels.fishing_rod).toBe(12);
    expect(s.mcRuns).toBe(1000); // clamped to min
    expect(s.mrNibblesQuestUnlocked).toBe(true); // inferred from rank > 0
    expect(s.sushiCardTier).toBe(3);
    expect(s.superStarsLevel).toBe(0);
    saveFishingState(s);
    expect(JSON.parse(store[FISHING_STORAGE_KEY]!)).toEqual(s);
  });
});
