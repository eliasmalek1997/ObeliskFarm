import type { GemSectionProps } from "./types";
import { buildEffectiveParams } from "../../lib/gems/model";
import "./summary.css";

const nf = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
const signed = (n: number) => (n < 0 ? "−" : "") + nf(Math.abs(n), Math.abs(n) < 10 ? 1 : 0);

export function GemsSummary({ inputs, overrides, setOverrides, snapshot }: GemSectionProps) {
  const income = snapshot.sources.filter((s) => s.kind === "income").sort((a, b) => b.gemsPerHour - a.gemsPerHour);
  const costs = snapshot.sources.filter((s) => s.kind === "cost").sort((a, b) => b.gemsPerHour - a.gemsPerHour);
  const gross = snapshot.grossPerHour;
  const saved = inputs.params.freebie_gems_base;
  const cycle = buildEffectiveParams(inputs, overrides).bomb_cycle === "late" ? "late" : "early";
  const cycleSet = overrides.bombCycle ?? null;
  const net = snapshot.netPerHour;

  const setGems = (v: string) => {
    const n = Number(v);
    setOverrides((o) => ({ ...o, gemsPerFreebieRoll: v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n }));
  };

  return (
    <section className="fv2Section">
      <div className="fv2SectionHead">
        <h2 className="fv2SectionTitle">Your gems now</h2>
      </div>
      <div className="fv2Card">
        <div className="fv2Muted">Net gems per hour</div>
        <div className={`gemsSumBig ${net >= 0 ? "fv2Good" : "fv2Bad"}`}>
          {nf(net)}
          <span className="gemsSumBigUnit fv2Muted">gems/h</span>
        </div>
        <div className="fv2Muted gemsSumSub">
          Gross {nf(gross)}/h − costs {nf(snapshot.costPerHour)}/h = net {nf(net)}/h
        </div>

        <div className="gemsSumRows">
          {income.map((s) => {
            const pct = gross > 0 ? (s.gemsPerHour / gross) * 100 : 0;
            return (
              <div className="gemsSumRow" key={s.id} title={s.note}>
                <div className="gemsSumRowTop">
                  <span className="gemsSumRowName">{s.label}</span>
                  <span className="gemsSumRowVal">
                    {nf(s.gemsPerHour)}/h <span className="fv2Muted">({nf(pct, 1)}%)</span>
                  </span>
                </div>
                <div className="fv2Bar">
                  <div className="fv2BarFill" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {costs.length > 0 && (
          <>
            <div className="fv2SectionTitle" style={{ fontSize: 15, marginTop: 16 }}>Gem costs</div>
            <ul className="gemsSumCostList">
              {costs.map((s) => (
                <li key={s.id}>
                  <span>{s.label}</span>
                  <span className="fv2Bad">−{nf(s.gemsPerHour)}/h</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {snapshot.nonGemCosts.length > 0 && (
          <div className="fv2Muted gemsSumSub">
            Not counted against gems (they buy other things):{" "}
            {snapshot.nonGemCosts.map((c, i) => (
              <span key={c.id} title={c.note}>
                {i > 0 ? "; " : ""}
                {c.label} −{nf(c.gemsPerHour)}/h
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="fv2Card gemsSumControls">
        <div className="gemsSumField">
          <label htmlFor="gemsPerFreebie">Gems per freebie</label>
          <input
            id="gemsPerFreebie"
            className="gemsSumInput"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={String(saved)}
            value={overrides.gemsPerFreebieRoll ?? ""}
            onChange={(e) => setGems(e.target.value)}
          />
          <div className="fv2Muted" style={{ fontSize: 13 }}>
            A normal freebie in-game shows this many gems. Leave empty to use your saved value ({saved}).
          </div>
        </div>

        <div className="gemsSumField">
          <label id="gemsCycleLbl">Bomb cycle</label>
          <div className="fv2Tabs gemsSumSeg" role="group" aria-labelledby="gemsCycleLbl">
            {(["early", "late"] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`fv2Tab ${cycle === c ? "fv2TabActive" : ""}`}
                aria-pressed={cycle === c}
                onClick={() => setOverrides((o) => ({ ...o, bombCycle: c }))}
              >
                {c === "early" ? "Early" : "Late"}
              </button>
            ))}
          </div>
          <div className="fv2Muted" style={{ fontSize: 13 }}>
            {cycle === "early"
              ? "Early: Cherry → Battery → D20 → Gem."
              : "Late: Cherry → Gem → Battery → D20 (cherry 3x bonus counts as gem-bomb clicks)."}
            {cycleSet ? " (what-if)" : " Using your saved setting."}
          </div>
        </div>
        <div className="fv2Muted" style={{ fontSize: 12 }}>
          These are what-ifs on this page only; they do not change the game or other modules. Net now: {signed(net)} gems/h.
        </div>
      </div>

      {snapshot.limitations.length > 0 && (
        <details className="fv2Card gemsSumDetails">
          <summary>What this estimate leaves out</summary>
          <ul className="fv2Muted">
            {snapshot.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
