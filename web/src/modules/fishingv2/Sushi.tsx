import { useEffect, useMemo, useState } from "react";
import type { FishingSectionProps } from "./types";
import { getFishById } from "../../lib/fishing";
import { computeFishingSnapshot, suggestDronePlacement } from "../../lib/fishing/model";
import { loadJson, saveJson } from "../../lib/storage";
import { coverage, nextUpgradeTarget, sushiAdvice, sushiYield, ticksPerSushi, type SushiYield } from "../../lib/fishing/sushi";
import "./sushi.css";

const KEY = "obeliskfarm:web:fishing_sushi.json";

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  if (a >= 100) return n.toFixed(0);
  return n.toFixed(1);
}

function Yield({ y, targetFishId, targetAmount, targetLabel }: { y: SushiYield; targetFishId?: string; targetAmount?: number; targetLabel?: string }) {
  const fishRows = Object.entries(y.perFish).filter(([, n]) => n >= 0.05).sort((a, b) => b[1] - a[1]);
  const cov = targetFishId && targetAmount ? coverage(y.perFish[targetFishId] ?? 0, targetAmount) : null;
  const name = targetFishId ? getFishById(targetFishId)?.name ?? targetFishId : "";
  return (
    <>
      <div className="fv2SushiBig">{fmt(y.totalFish)} fish</div>
      {fishRows.slice(0, 8).map(([id, n]) => (
        <div key={id} className="fv2SushiRow">
          <span>{getFishById(id)?.name ?? id}</span>
          <span>{fmt(n)}</span>
        </div>
      ))}
      {cov != null && (
        <>
          <div className="fv2Bar" role="img" aria-label={`Covers ${(cov * 100).toFixed(0)} percent`}>
            <div className="fv2BarFill" style={{ width: `${Math.min(100, cov * 100)}%` }} />
          </div>
          <div className="fv2Muted" style={{ fontSize: 13 }}>
            covers {(cov * 100).toFixed(cov < 0.1 ? 1 : 0)}% of the {fmt(targetAmount!)} {name} for {targetLabel}
          </div>
        </>
      )}
    </>
  );
}

export function Sushi(props: FishingSectionProps) {
  const { state, snapshot, ranked, ctx } = props;
  const [owned, setOwned] = useState<number>(() => {
    const v = loadJson<{ owned?: number }>(KEY)?.owned;
    return typeof v === "number" && v >= 0 ? Math.floor(v) : 0;
  });
  useEffect(() => saveJson(KEY, { owned }), [owned]);

  const per = ticksPerSushi(state.sushiCardTier, state.workshopSushiTicksWorld3 ?? 0);
  const ticks = per * owned;
  const target = useMemo(() => nextUpgradeTarget(ranked), [ranked]);

  const cur = useMemo(() => sushiYield(snapshot.docks, ticks), [snapshot, ticks]);
  const best = useMemo(() => {
    if (!target) return null;
    const sug = suggestDronePlacement(state, ctx, { kind: "farm-fish", fishId: target.fishId });
    const snap = computeFishingSnapshot({ ...state, dronesPerDock: { ...state.dronesPerDock, ...sug.dronesPerDock }, activeDockId: sug.activeDockId }, ctx);
    return sushiYield(snap.docks, ticks);
  }, [state, ctx, target, ticks]);

  const curT = target ? cur.perFish[target.fishId] ?? 0 : 0;
  const bestT = target && best ? best.perFish[target.fishId] ?? 0 : 0;
  const farms = !!target && (snapshot.fishRates[target.fishId] ?? 0) > 0 && curT >= bestT * 0.999;
  const advice = sushiAdvice({ hasTarget: !!target, currentFarmsTarget: farms, currentTargetFish: curT, bestTargetFish: bestT });
  const tIds = target ? { targetFishId: target.fishId, targetAmount: target.amount, targetLabel: target.label } : {};

  return (
    <section className="fv2Section" aria-label="Sushi">
      <h2 className="fv2SectionTitle">Sushi</h2>
      <div className="fv2Card">
        <div className="fv2SushiHead">
          <label htmlFor="fv2SushiOwned">Sushi you have</label>
          <div className="fv2Stepper">
            <button type="button" aria-label="Fewer sushi" disabled={owned <= 0} onClick={() => setOwned((n) => Math.max(0, n - 1))}>−</button>
            <input
              id="fv2SushiOwned"
              className="fv2SushiInput"
              type="number"
              inputMode="numeric"
              min={0}
              value={owned}
              onChange={(e) => setOwned(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
            <button type="button" aria-label="More sushi" onClick={() => setOwned((n) => n + 1)}>+</button>
          </div>
        </div>
        <p className="fv2Muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
          <strong>{per}</strong> ticks per sushi, <strong>{fmt(ticks)}</strong> ticks total.
        </p>
      </div>

      <div className="fv2SushiGrid">
        <div className="fv2Card">
          <strong>Use all now (current placement)</strong>
          <Yield y={cur} {...tIds} />
        </div>
        {best && (
          <div className="fv2Card">
            <strong>If placed for next upgrade</strong>
            <Yield y={best} {...tIds} />
          </div>
        )}
      </div>

      <div className="fv2Card">
        <div className="fv2SushiAdvice">
          <strong className={advice.text.startsWith("Move") ? "fv2Warn" : "fv2Good"}>{advice.text}</strong>{" "}
          <span className="fv2Muted">{advice.reason}</span>
        </div>
        <p className="fv2Muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          Sushi ticks are instant and unaffected by the Elixir 3x tick speed buff, so there is no reason to save it for that buff. Your double/triple/5x tick chances do apply.
        </p>
      </div>
    </section>
  );
}
