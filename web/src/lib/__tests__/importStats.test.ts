import { afterEach, describe, expect, it, vi } from "vitest";
import { applyStatsImport } from "../importStats";

function stubStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  });
  return store;
}
afterEach(() => vi.unstubAllGlobals());

describe("importStats gem mappings", () => {
  it("maps freebie_5x_chance to jackpot_chance and freebie_gems_bonus to freebie_gems_base", () => {
    const store = stubStorage();
    const rep = applyStatsImport({ freebie_5x_chance: 13, freebie_gems_bonus: 16, obelisk_level: 49 }, null);
    const gem = JSON.parse(store["obeliskfarm:web:gemev_save.json:v1"]!);
    const bombs = JSON.parse(store["obeliskfarm:web:bombs_save.json:v1"]!);
    expect(gem.params.jackpot_chance).toBeCloseTo(0.13, 10);
    expect(gem.params.freebie_gems_base).toBe(16);
    expect(bombs.params.freebie_gems_base).toBe(16);
    expect(rep.unusedKeys).not.toContain("freebie_5x_chance");
    expect(rep.unusedKeys).not.toContain("freebie_gems_bonus");
    expect(rep.notes.join(" ")).not.toMatch(/Freebie gems \(base\) is not imported/);
  });
});

describe("importStats drone fuel mappings", () => {
  it("maps the coal fuel duration multiplier and save chance onto the Drone save", () => {
    const store = stubStorage();
    applyStatsImport({ coal_fuel_duration_multi: 2.0110960800000002, coal_fuel_save_chance: 26.6, elixir_fuel_grade: 15 }, null);
    const drone = JSON.parse(store["obeliskfarm:web:drone_elixir_save.json:v9"]!);
    expect(drone.fuelDurationUpgradeLevel).toBeCloseTo(101.1096, 3);
    expect(drone.fuelSaveChanceUpgradeLevel).toBeCloseTo(26.6, 10);
  });
});
