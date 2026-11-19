import { AQUARIUM, DOCKS } from "../../lib/fishing/constants";
import { getUnlockedDockIds } from "../../lib/fishing/model";
import { computeFishingStatsFromLevels } from "../../lib/fishing/computeStats";
import { buildTotalFishOptions } from "../../lib/fishing/model";
import type { FishingSectionProps } from "./types";
import { fishIcon } from "./buynext/helpers";
import { InventoryReader } from "./InventoryReader";
import "./inventory.css";

function fmtWhen(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "never" : d.toLocaleString();
}

/** "Fish you own": feeds every time estimate on the page. */
export function Inventory({ state, inventory, setInventory }: FishingSectionProps) {
  const s = computeFishingStatsFromLevels(state.upgradeLevels ?? {}, state.enhanceLevels ?? {}, buildTotalFishOptions(state));
  const unlocked = new Set(getUnlockedDockIds(s.boat_level, s.t2_boat_level ?? 0));
  const now = () => new Date().toISOString();

  const apply = (counts: Record<string, number>) =>
    setInventory((inv) => ({ counts: { ...inv.counts, ...counts }, updatedAt: now() }));
  const setOne = (id: string, n: number) =>
    setInventory((inv) => ({ counts: { ...inv.counts, [id]: Math.max(0, Math.floor(n) || 0) }, updatedAt: now() }));

  return (
    <section className="fv2Section">
      <h2 className="fv2SectionTitle">Fish you own</h2>
      <InventoryReader onApply={apply} />
      <div className="fv2Card">
        {AQUARIUM.map((set) => {
          const name = DOCKS.find((d) => d.id === set.dockId)?.name ?? set.dockId;
          return (
            <details className="fv2InvDock" key={set.dockId} open={unlocked.has(set.dockId)}>
              <summary>{name}{unlocked.has(set.dockId) ? "" : " (locked)"}</summary>
              <div className="fv2InvGrid">
                {set.fish.map((f) => {
                  const icon = fishIcon(f.id);
                  return (
                    <label className="fv2InvFish" key={f.id}>
                      {icon && <img src={icon} alt="" width={24} height={24} loading="lazy" />}
                      <span className="fv2InvName">{f.name}</span>
                      <input
                        className="fv2InvInput"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={`${f.name} owned`}
                        value={inventory.counts[f.id] ?? 0}
                        onChange={(e) => setOne(f.id, Number(e.target.value))}
                      />
                    </label>
                  );
                })}
              </div>
            </details>
          );
        })}
        <div className="fv2InvFoot" style={{ marginTop: 10 }}>
          <span className="fv2Muted">Last updated {fmtWhen(inventory.updatedAt)}</span>
          <button type="button" className="fv2SetupBtn" onClick={() => setInventory({ counts: {}, updatedAt: null })}>
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
