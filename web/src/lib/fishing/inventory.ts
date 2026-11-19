/** Player's owned fish counts (read from a screenshot or typed in). Persisted separately from the Fishing state. */
import { loadJson, saveJson } from "../storage";
import { ALL_FISH } from "./constants";

export const FISH_INVENTORY_KEY = "obeliskfarm:web:fishing_inventory.json";

export type FishInventory = {
  counts: Record<string, number>;
  /** ISO timestamp of the last change, null when never set. */
  updatedAt: string | null;
};

export function emptyFishInventory(): FishInventory {
  return { counts: {}, updatedAt: null };
}

function cleanCounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const f of ALL_FISH) {
    const v = r[f.id];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[f.id] = Math.floor(v);
  }
  return out;
}

export function loadFishInventory(): FishInventory {
  const raw = loadJson<Partial<FishInventory>>(FISH_INVENTORY_KEY);
  if (!raw || typeof raw !== "object") return emptyFishInventory();
  return {
    counts: cleanCounts(raw.counts),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function saveFishInventory(inv: FishInventory): void {
  saveJson(FISH_INVENTORY_KEY, { counts: cleanCounts(inv.counts), updatedAt: inv.updatedAt });
}
