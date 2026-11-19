import { useState } from "react";
import type { FishingSectionProps } from "./types";
import { ALL_FISH, dockIconUrl, fishIconUrl, getFishById, type DockId } from "../../lib/fishing";
import { suggestDronePlacement, getDockIdForFish, type DockSnapshot, type PlacementSuggestion } from "../../lib/fishing/model";
import { nextUpgradeTarget } from "../../lib/fishing/sushi";
import { Tooltip } from "../../components/Tooltip";
import "./docks.css";

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  if (a >= 100) return n.toFixed(0);
  if (a >= 1) return n.toFixed(1);
  return n.toFixed(2);
}

const TIER_NAME = ["None", "Card", "Gilded", "Poly"];

const LIMIT_CHIP: Record<DockSnapshot["limitedBy"], { text: string; cls: string; tip: string }> = {
  power: {
    text: "Limited by power",
    cls: "fv2Warn",
    tip: "Your rarest fish here is caught less than 100% of fills. More drone or rod power helps most.",
  },
  ticks: {
    text: "Limited by ticks",
    cls: "fv2Good",
    tip: "All four fish are caught on every fill. Faster ticks, income multipliers and shiny help more than power.",
  },
  locked: { text: "Locked", cls: "", tip: "Upgrade the boat to unlock this dock." },
  idle: { text: "Not fished", cls: "fv2Muted", tip: "No rod or drones are on this dock, so it catches nothing. Add drones or put the rod here to farm its fish." },
};

export function Docks(props: FishingSectionProps) {
  const { state, setState, snapshot, ctx, ranked } = props;
  const target = nextUpgradeTarget(ranked);
  const targetFish = target ? getFishById(target.fishId) : undefined;
  const targetDock = target ? getDockIdForFish(target.fishId) : undefined;
  const targetDockName = snapshot.docks.find((d) => d.dockId === targetDock)?.name;
  const [farmFish, setFarmFish] = useState<string>("");
  const unlocked = snapshot.docks.filter((d) => d.unlocked);
  const locked = snapshot.docks.filter((d) => !d.unlocked);
  const cap = snapshot.droneCap;
  const used = snapshot.dronesAssigned;

  const apply = (s: PlacementSuggestion) =>
    setState((st) => ({ ...st, dronesPerDock: { ...st.dronesPerDock, ...s.dronesPerDock }, activeDockId: s.activeDockId }));
  const suggest = (kind: "top-dock" | "max-fish") => apply(suggestDronePlacement(state, ctx, { kind }));
  const farm = (fishId: string) => {
    setFarmFish(fishId);
    if (fishId) apply(suggestDronePlacement(state, ctx, { kind: "farm-fish", fishId }));
  };
  const bestForNext = () => target && apply(suggestDronePlacement(state, ctx, { kind: "farm-fish", fishId: target.fishId }));
  const clearAll = () => setState((st) => ({ ...st, dronesPerDock: Object.fromEntries(Object.keys(st.dronesPerDock ?? {}).map((k) => [k, 0])) as typeof st.dronesPerDock }));
  const setDrones = (id: DockId, n: number) =>
    setState((st) => ({ ...st, dronesPerDock: { ...st.dronesPerDock, [id]: Math.max(0, n) } }));
  const setRod = (id: DockId) => setState((st) => ({ ...st, activeDockId: id }));

  const unlockedFish = unlocked.flatMap((d) => d.fish.map((f) => f.fishId));
  const farmOptions = ALL_FISH.filter((f) => unlockedFish.includes(f.id));

  return (
    <section className="fv2Section" aria-label="Docks">
      <h2 className="fv2SectionTitle">Docks</h2>
      <div className="fv2DockToolbar">
        <button type="button" className="fv2DockBtn fv2DockBtnPrimary" onClick={() => suggest("top-dock")}>
          Suggest: all on best dock
        </button>
        <button type="button" className="fv2DockBtn fv2DockBtnPrimary" onClick={() => suggest("max-fish")}>
          Suggest: most fish
        </button>
        <button type="button" className="fv2DockBtn fv2DockBtnPrimary" disabled={!target} onClick={bestForNext}>
          Best for next upgrade
        </button>
        <button type="button" className="fv2DockBtn" disabled={used <= 0} onClick={clearAll}>
          Clear all drones
        </button>
        <select className="fv2DockSelect" aria-label="Farm a fish" value={farmFish} onChange={(e) => farm(e.target.value)}>
          <option value="">Farm a fish…</option>
          {farmOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <span className="fv2DockCap fv2Muted">
          Drones placed: <strong>{used}</strong> / {cap}
          {used < cap ? ` (${cap - used} idle)` : ""}
        </span>
      </div>

      <p className="fv2Muted fv2DockTarget">
        {target
          ? `Best for next upgrade targets ${target.label} → ${targetFish?.name ?? target.fishId}${targetDockName ? ` (${targetDockName})` : ""}`
          : "Best for next upgrade: no fish-priced upgrade queued."}
      </p>

      <div className="fv2DockList">
        {unlocked.map((d) => {
          const lim = LIMIT_CHIP[d.limitedBy];
          const canAdd = used < cap;
          return (
            <div key={d.dockId} className="fv2Card">
              <div className="fv2DockHead">
                <img className="fv2DockIcon" src={dockIconUrl(d.dockId)} alt="" loading="lazy" />
                <span className="fv2DockName">{d.name}</span>
                <span className="fv2Muted">Tier {d.tier}</span>
                <span className={`fv2Chip ${lim.cls}`}>{lim.text}</span>
                <Tooltip content={{ title: lim.text, lines: [lim.tip] }} />
              </div>
              <div className="fv2DockStats">
                <span>
                  <strong>{fmt(d.fishPerHour)}</strong> fish/h
                </span>
                <span className="fv2Muted">{fmt(d.fillsPerHour)} fills/h</span>
                <span className="fv2Muted">{d.ticksNeeded} ticks per fill</span>
                <span className="fv2Muted">power {fmt(d.powerOnDock)}</span>
              </div>
              <div className="fv2DockCtl">
                <span>Drones</span>
                <button type="button" className="fv2DockStep" aria-label={`Remove all drones from ${d.name}`} disabled={d.dronesAssigned <= 0} onClick={() => setDrones(d.dockId, 0)}>
                  −−
                </button>
                <button type="button" className="fv2DockStep" aria-label={`Remove drone from ${d.name}`} disabled={d.dronesAssigned <= 0} onClick={() => setDrones(d.dockId, d.dronesAssigned - 1)}>
                  −
                </button>
                <span className="fv2DockCount">{d.dronesAssigned}</span>
                <button type="button" className="fv2DockStep" aria-label={`Add drone to ${d.name}`} disabled={!canAdd} onClick={() => setDrones(d.dockId, d.dronesAssigned + 1)}>
                  +
                </button>
                <button type="button" className="fv2DockBtn" disabled={!canAdd} onClick={() => setDrones(d.dockId, d.dronesAssigned + (cap - used))} title="Put all idle drones here">
                  +all idle
                </button>
                <span style={{ flex: 1 }} />
                {d.hasRod ? (
                  <span className="fv2Chip fv2Good">Rod here</span>
                ) : (
                  <button type="button" className="fv2DockBtn" onClick={() => setRod(d.dockId)}>
                    Put rod here
                  </button>
                )}
              </div>
              {d.fish.map((f) => {
                const pct = f.catchChancePct;
                const scale = Math.max(100, pct);
                const over = pct > 100;
                const def = getFishById(f.fishId);
                return (
                  <div key={f.fishId} className="fv2DockFish">
                    {def ? <img className="fv2DockFishIcon" src={fishIconUrl(def.iconFile)} alt="" loading="lazy" /> : <span />}
                    <span className="fv2DockFishName">
                      {f.name}
                      <span className={`fv2DockTier fv2DockTier${f.cardTier}`} title={`Card: ${TIER_NAME[f.cardTier]}`}>
                        {TIER_NAME[f.cardTier]}
                      </span>
                    </span>
                    <span className="fv2DockRate">{fmt(f.perHour)}/h</span>
                    <div
                      className="fv2DockBar"
                      role="img"
                      aria-label={`${f.name} catch chance ${pct.toFixed(0)} percent`}
                    >
                      <div className={`fv2DockBarFill${over ? " fv2DockOver" : ""}`} style={{ width: `${(pct / scale) * 100}%` }} />
                      <div className="fv2DockBarMark" style={{ left: `calc(${(100 / scale) * 100}% - 1px)` }} />
                    </div>
                    <span className="fv2DockBarLabel">
                      {over ? `${pct.toFixed(0)}% (x${(pct / 100).toFixed(1)} per fill)` : `${pct.toFixed(pct < 10 ? 1 : 0)}% catch chance`}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {locked.length > 0 && (
        <p className="fv2Muted fv2DockLocked">Locked: {locked.map((d) => d.name).join(", ")} — upgrade the boat.</p>
      )}
    </section>
  );
}
