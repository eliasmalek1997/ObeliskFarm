import { useMemo, useState } from "react";
import { Tooltip } from "../../components/Tooltip";
import { loadJson } from "../../lib/storage";
import { readFishingCalibration, writeFishingCalibration } from "../../lib/fishing/calibration";
import type { FishingStatsSnapshot } from "../../lib/fishing/model";
import { formatInt } from "../../lib/format";
import { fishTrack } from "../../lib/fishing/ranking";
import type { DockLimit } from "../../lib/fishing/model";
import type { FishingSectionProps } from "./types";
import { fishName, fmtHours, fmtPct } from "./buynext/helpers";
import "./buynext.css";

function bottleneck(limit: DockLimit, rarestPct: number | undefined): string {
  if (limit === "power") {
    const p = rarestPct != null ? ` (rarest fish caught ${Math.min(100, Math.round(rarestPct))}% of fills)` : "";
    return `Needs more power${p}`;
  }
  if (limit === "ticks") return "Maxed on catch. Faster ticks help here";
  if (limit === "idle") return "Not fished: no rod or drones here";
  return "Locked";
}

export function Summary({ snapshot, ranked, setState }: FishingSectionProps) {
  const st = snapshot.stats;
  const top = fishTrack([...ranked])[0];
  const docks = snapshot.docks.filter((d) => d.unlocked && d.limitedBy !== "idle");
  const idleDocks = snapshot.docks.filter((d) => d.limitedBy === "idle");
  const cal = readFishingCalibration();
  const check = useMemo(() => compareWithGame(st, cal), [st, cal?.rodPowerMult, cal?.incomeMult, cal?.droneMultMult]); // eslint-disable-line react-hooks/exhaustive-deps

  let takeaway = "Nothing left to buy with fish right now.";
  if (top) {
    const lvl = top.structural ? "" : ` L${top.toLevel}`;
    const hrs = top.hoursToAfford ?? top.hoursIfFocused;
    const when = top.affordableNow
      ? `you already have the ${fishName(top.cost.fishId)}`
      : hrs != null
        ? `~${fmtHours(hrs).replace("~", "")} more ${fishName(top.cost.fishId)}`
        : `costs ${fishName(top.cost.fishId)}`;
    takeaway = top.structural
      ? `Your best next step: ${top.name} (unlocks ${(top.unlocks ?? []).slice(0, 2).join(", ") || "more upgrades"}; ${when}).`
      : `Your best next step: ${top.name}${lvl} (+${fmtPct(top.gainPct)}% fish, ${when}).`;
  }

  return (
    <section className="fv2Section">
      <h2 className="fv2SectionTitle">Your fishing now</h2>
      <div className="fv2Card fv2SumHead">
        <div className="fv2SumBig">
          {formatInt(snapshot.totalFishPerHour)} <span className="fv2Muted">fish / hour</span>
        </div>
        <div className="fv2SumTake">{takeaway}</div>
        <div className="fv2SumStats">
          <div><span className="fv2Muted">Rod power</span><b>{formatInt(st.rodPower)}</b></div>
          <div><span className="fv2Muted">Drones</span><b>{snapshot.dronesAssigned}/{snapshot.droneCap}</b></div>
          <div><span className="fv2Muted">Tick</span><b>{st.tickSeconds.toFixed(2)}s</b></div>
          <div><span className="fv2Muted">Double tick</span><b>{st.doubleTickPct.toFixed(0)}%</b></div>
          <div><span className="fv2Muted">Triple tick</span><b>{st.tripleTickPct.toFixed(0)}%</b></div>
        </div>
      </div>
      <div className="fv2SumDocks">
        {docks.map((d) => {
          const rarest = d.fish[d.fish.length - 1]?.catchChancePct;
          return (
            <div className="fv2Card fv2SumDock" key={d.dockId}>
              <div className="fv2SumDockTop">
                <b>{d.name}</b>
                <span>{formatInt(d.fishPerHour)}/h</span>
              </div>
              <div className={`fv2SumDockNote ${d.limitedBy === "power" ? "fv2Warn" : "fv2Muted"}`}>
                {bottleneck(d.limitedBy, rarest)}
              </div>
            </div>
          );
        })}
      </div>
      {idleDocks.length > 0 && (
        <div className="fv2Muted fv2SumIdle">Not fished right now: {idleDocks.map((d) => d.name).join(", ")}. See Docks below to move drones.</div>
      )}
      {check && <GameCheck rows={check} cal={cal} setState={setState} />}
      <span className="fv2Muted fv2SumFoot">
        Per-dock bottleneck{" "}
        <Tooltip
          content={{
            title: "Bottleneck",
            lines: [
              "Needs more power: your rarest fish here is not caught on every fill, so extra power adds fish.",
              "Maxed on catch: every fish is caught on every fill, so faster ticks and multipliers add more.",
            ],
          }}
        />
      </span>
    </section>
  );
}

/** Written by Import stats: the game's own fishing totals, used to spot inputs the export can't fill in. */
const INGAME_KEY = "obeliskfarm:web:fishing_ingame.json";
type InGame = { version?: string | null; rodPower?: number; droneCap?: number; droneMulti?: number; incomeMulti?: number };

type Factors = { rodPowerMult: number; incomeMult: number; droneMultMult: number };
type CheckRow = { label: string; game: number; here: number; ok: boolean; hint: string; key?: keyof Factors; raw: number };

function compareWithGame(st: FishingStatsSnapshot, cal: ReturnType<typeof readFishingCalibration>): CheckRow[] | null {
  const g = loadJson<InGame>(INGAME_KEY);
  if (!g) return null;
  const rows: CheckRow[] = [];
  const add = (label: string, game: number | undefined, here: number, hint: string, key?: keyof Factors) => {
    if (typeof game !== "number" || !Number.isFinite(game) || game === 0) return;
    // `here` already includes an active calibration; `raw` is the uncalibrated value the factor is relative to.
    const f = key && cal ? (cal[key] ?? 1) : 1;
    rows.push({ label, game, here, ok: Math.abs(here - game) / Math.abs(game) < 0.005, hint, key, raw: here / f });
  };
  add("Rod power", g.rodPower, st.rodPowerWithCard, "Check the Fishing Rod card tier, Half-Way Bundle and skills in Your setup.", "rodPowerMult");
  add("Drone cap", g.droneCap, st.droneCapExact, "Check the Fishing With Friends skill and drone upgrades.");
  add("Drone multiplier", g.droneMulti, st.droneMulti, "Check drone enhancements and the Angler bundle.", "droneMultMult");
  add("Fish income multiplier", g.incomeMulti, st.incomeMulti, "Check fish multiplier enhancements, Super Stars and idols.", "incomeMult");
  return rows.length ? rows : null;
}

function fmtNum(n: number): string {
  return Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(3);
}

function GameCheck({
  rows,
  cal,
  setState,
}: {
  rows: CheckRow[];
  cal: ReturnType<typeof readFishingCalibration>;
  setState: FishingSectionProps["setState"];
}) {
  const [, bump] = useState(0);
  const bad = rows.filter((r) => !r.ok);
  const fixable = rows.filter((r) => r.key && !r.ok && r.key !== "droneMultMult");
  const apply = () => {
    const f: Factors = { rodPowerMult: cal?.rodPowerMult ?? 1, incomeMult: cal?.incomeMult ?? 1, droneMultMult: cal?.droneMultMult ?? 1 };
    for (const r of rows) if (r.key && !r.ok) f[r.key] = r.game / r.raw;
    writeFishingCalibration({ enabled: true, ...f });
    bump((n) => n + 1);
    setState((s) => ({ ...s }));
  };
  const turnOff = () => {
    writeFishingCalibration({ enabled: false, rodPowerMult: 1, incomeMult: 1 });
    bump((n) => n + 1);
    setState((s) => ({ ...s }));
  };
  const fx = (n: number | undefined) => (n ?? 1).toFixed(3);
  return (
    <div className={`fv2Card fv2SumCheck ${bad.length ? "fv2SumCheckBad" : ""}`}>
      <b>{bad.length ? "Some numbers don't match your game yet" : "Matches your game ✓"}</b>
      <div className="fv2Muted">
        {bad.length
          ? "Your stats export doesn't include skills, bundles or every card, so set those in Your setup until these match."
          : "The page reproduces the fishing stats from your last import."}
      </div>
      {cal && (
        <div className="fv2SumCal">
          Using your game's numbers (
          {[
            ["rod", cal.rodPowerMult],
            ["income", cal.incomeMult],
            ["drone multi", cal.droneMultMult ?? 1],
          ]
            .filter(([, v]) => Math.abs((v as number) - 1) > 1e-6)
            .map(([k, v]) => `${k} ×${fx(v as number)}`)
            .join(", ")}{" "}
          from bonuses this page doesn't model yet)
          <button type="button" className="fv2SetupBtn" onClick={turnOff}>Turn off</button>
        </div>
      )}
      {!cal && fixable.length > 0 && (
        <div className="fv2SumCal">
          <span className="fv2Muted">If the remaining gap is a bonus this page doesn't model, copy your game's values.</span>
          <button type="button" className="fv2SetupBtn" onClick={apply}>Use my game's numbers</button>
        </div>
      )}
      {cal && bad.length > 0 && (
        <div className="fv2SumCal">
          <button type="button" className="fv2SetupBtn" onClick={apply}>Re-calibrate</button>
        </div>
      )}
      <ul className="fv2SumCheckList">
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <span className={r.ok ? "fv2Good" : "fv2Warn"}>
              here {fmtNum(r.here)} · game {fmtNum(r.game)}
            </span>
            {!r.ok && <span className="fv2Muted fv2SumCheckHint">{r.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
