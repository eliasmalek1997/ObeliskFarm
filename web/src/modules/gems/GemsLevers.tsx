import type { GemOverrides } from "../../lib/gems/inputs";
import type { GemLever } from "../../lib/gems/levers";
import type { DroneId } from "../../lib/drone/model";
import type { GemSectionProps } from "./types";
import "./summary.css";

const nf = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const gain = (n: number) => `${n < 0 ? "−" : "+"}${nf(Math.abs(n), Math.abs(n) < 10 ? 1 : 0)} gems/h`;
const FREE = new Set(["setting", "drone", "lootbug"]);

function payback(h: number): string {
  if (h < 1) return "under an hour";
  if (h < 48) return `~${nf(h, 1)} hours`;
  return `~${nf(h / 24, 1)} days`;
}

export function GemsLevers({ inputs, overrides, setOverrides, levers }: GemSectionProps) {
  const free = levers.filter((l) => FREE.has(l.kind) && l.deltaNetPerHour > 0.5).sort((a, b) => b.deltaNetPerHour - a.deltaNetPerHour);
  const lose = levers.filter((l) => FREE.has(l.kind) && l.deltaNetPerHour < -0.5).sort((a, b) => a.deltaNetPerHour - b.deltaNetPerHour);
  const hasPrices = levers.some((l) => l.kind === "purchase" && l.paybackHours != null);
  const buys = levers
    .filter((l) => l.kind === "purchase" && l.deltaNetPerHour > 0)
    .sort((a, b) => {
      const pa = a.paybackHours ?? Infinity, pb = b.paybackHours ?? Infinity;
      if (hasPrices && pa !== pb) return pa - pb;
      return b.deltaNetPerHour - a.deltaNetPerHour;
    });

  const active =
    overrides.bombCycle != null || overrides.lootbugBuy != null || overrides.chaosTotemFull != null ||
    Object.keys(overrides.droneFuel ?? {}).length > 0 || Object.keys(overrides.droneOn ?? {}).length > 0;

  /** The model supplies the exact what-if change it measured (see GemLever.whatIf). */
  const patchFor = (l: GemLever): ((o: GemOverrides) => GemOverrides) | null => l.whatIf ?? null;

  const setPrice = (id: string, v: string) => {
    const n = Number(v);
    setOverrides((o) => {
      const prices = { ...(o.prices ?? {}) };
      if (v.trim() === "" || !Number.isFinite(n) || n < 0) delete prices[id];
      else prices[id] = n;
      return { ...o, prices };
    });
  };
  const reset = () =>
    setOverrides((o) => ({ prices: o.prices, gemsPerFreebieRoll: null, bombCycle: null, lootbugBuy: null, droneFuel: {}, droneOn: {}, chaosTotemFull: undefined }));

  const card = (l: GemLever, isBuy: boolean) => {
    const patch = isBuy ? null : patchFor(l);
    return (
      <div className="fv2Card gemsLevCard" key={l.id}>
        <div className="gemsLevTop">
          <span className="gemsLevLabel">{l.label}</span>
          <span className={`gemsLevGain ${l.deltaNetPerHour >= 0 ? "fv2Good" : "fv2Bad"}`}>{gain(l.deltaNetPerHour)}</span>
        </div>
        <div className="gemsLevHow">{l.how}</div>
        {l.note && <div className="gemsLevNote fv2Muted">{l.note}</div>}
        {isBuy && (
          <div className="gemsLevPrice">
            <label className="fv2Muted" htmlFor={`price_${l.id}`}>Price (gems)</label>
            <input
              id={`price_${l.id}`}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="optional"
              value={overrides.prices?.[l.id] ?? ""}
              onChange={(e) => setPrice(l.id, e.target.value)}
            />
            {l.paybackHours != null && <span className="fv2Chip fv2Good">pays back in {payback(l.paybackHours)}</span>}
          </div>
        )}
        {patch && (
          <button type="button" className="gemsLevBtn" onClick={() => setOverrides(patch)}>
            Apply as what-if
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="fv2Section">
      <div className="fv2SectionHead">
        <h2 className="fv2SectionTitle">Do this next</h2>
        {active && (
          <button type="button" className="gemsLevBtn" onClick={reset}>Reset what-ifs</button>
        )}
      </div>
      <div className="fv2Muted" style={{ fontSize: 13 }}>
        "Apply as what-if" only updates the numbers on this page. Remember to make the change in the game; to keep it in other modules, change it there too.
      </div>

      <div className="gemsLevGroup">
        <h3 className="gemsLevGroupTitle">Free changes</h3>
        {free.length === 0 ? <div className="fv2Muted">No free change gains gems right now.</div> : free.map((l) => card(l, false))}
        {lose.length > 0 && (
          <details className="gemsLevDetails">
            <summary>Changes that would lose gems</summary>
            <div className="gemsLevLose">
              {lose.map((l) => (
                <div key={l.id}>
                  <strong>{l.label}</strong> <span className="fv2Bad">{gain(l.deltaNetPerHour)}</span>
                  {l.note && <div className="fv2Muted" style={{ fontSize: 13 }}>{l.note}</div>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="gemsLevGroup">
        <h3 className="gemsLevGroupTitle">Upgrades to buy</h3>
        <div className="fv2Muted" style={{ fontSize: 13 }}>
          {hasPrices ? "Sorted by how fast they pay back." : "Sorted by gain. Enter a price to sort by payback."}
        </div>
        {buys.length === 0 ? <div className="fv2Muted">Nothing to buy that adds gems.</div> : buys.map((l) => card(l, true))}
      </div>
    </section>
  );
}
