import { useState } from "react";
import { applyDroneOverrides } from "../../lib/gems/model";
import { planFreeChanges, rankGemLevers } from "../../lib/gems/levers";
import { DRONE_DEFS, droneDef } from "../../lib/drone/model";
import type { GemSectionProps } from "./types";
import { fmtGems } from "./GemsDrones";

const FREEBIE_SOURCES = ["freebie_gems", "stonks", "skill_shards"];
const LOOTBUG_SOURCES = ["lootbug_gems", "lootbug_cherry"];
const WAITS = [30, 60, 120, 240];

function fmtMin(m: number): string {
  if (m < 90) return `${Math.round(m)} min`;
  return `${(m / 60).toFixed(1)} h`;
}

export function GemsRoutine({ inputs, overrides, snapshot, levers }: GemSectionProps) {
  const { claim, afk } = snapshot;
  const defHours = inputs.overnight.sleepHours;
  const hoursList = [...new Set([6, 8, 10, ...(defHours > 0 ? [Math.round(defHours * 10) / 10] : [])])].sort((a, b) => a - b);
  const [hours, setHours] = useState<number>(defHours > 0 ? Math.round(defHours * 10) / 10 : 8);

  const eff = applyDroneOverrides(inputs.drone, overrides);
  const rec = eff as unknown as Record<string, unknown>;
  const streamRate = (ids: string[]) => snapshot.sources.filter((s) => ids.includes(s.id)).reduce((s, x) => s + x.gemsPerHour, 0);
  const freebieRate = streamRate(FREEBIE_SOURCES);
  const lootbugRate = streamRate(LOOTBUG_SOURCES);
  const lossAt = (w: number) => {
    const f = claim.freebieBankFillMinutes != null ? freebieRate * Math.max(0, 1 - claim.freebieBankFillMinutes / w) : 0;
    const l = claim.lootbugBankFillMinutes != null ? lootbugRate * Math.max(0, 1 - claim.lootbugBankFillMinutes / w) : 0;
    return f + l;
  };

  const fueledNow = afk.netPerHourAfk * hours;
  const unfueled = afk.netPerHourAfkUnfueled * hours;
  const unfuelBetter = unfueled > fueledNow + 0.5;
  const banked = afk.bankedFreebiesGems + afk.bankedLootbugsGems;
  const afkDrones = DRONE_DEFS.filter((d) => d.gemRelevant && d.id !== "bear" && Boolean(rec[d.fueled as string]) && Boolean(rec[d.on as string])).map((d) => d.label);
  const gainUnfuel = unfueled - fueledNow;

  // ---- checklist: free changes applied in sequence, so the steps never contradict each other.
  const plan = planFreeChanges(inputs, overrides);
  const today: string[] = plan.steps.map((st) =>
    st.id === "bomb_cycle"
      ? `switch bomb cycle to ${st.label.split(": ")[1] ?? "other"} (+${Math.round(st.deltaNetPerHour)}/h)`
      : `${st.label.charAt(0).toLowerCase() + st.label.slice(1)} (+${Math.round(st.deltaNetPerHour)}/h)`,
  );
  // After the plan, any gem drone that is still fueled and whose fuel pays for itself: say so explicitly.
  const planned = applyDroneOverrides(inputs.drone, plan.finalOverrides) as unknown as Record<string, unknown>;
  for (const l of rankGemLevers(inputs, plan.finalOverrides)) {
    if (!l.id.startsWith("fuel_") || l.deltaNetPerHour >= 0) continue;
    const id = l.id.slice(5) as Parameters<typeof droneDef>[0];
    if (Boolean(planned[droneDef(id).fueled as string]) && id !== "elixir") today.push(`keep ${droneDef(id).label} fueled`);
  }
  const buying = new Set(plan.finalOverrides.lootbugBuy ?? overrides.lootbugBuy ?? inputs.lootbug.activeGemBuffs);
  const skip = levers.filter((l) => l.id.startsWith("lootbug_buy_") && !buying.has(l.id.slice(12)) && l.deltaNetPerHour <= 0).map((l) => l.id.slice(12));
  if (skip.length) today.push(`don't buy Lootbug ${skip.join(" / ")}`);
  if (claim.recommendedClaimEveryMinutes != null) today.push(`claim every ${Math.max(1, Math.floor(claim.recommendedClaimEveryMinutes))} min`);
  if (unfuelBetter && afkDrones.length) today.push(`unfuel ${afkDrones.join("/")} before sleep`);

  return (
    <section className="fv2Section">
      <div className="fv2SectionHead"><h2 className="fv2SectionTitle">Your routine</h2></div>

      <div className="fv2Card">
        <strong>Active play</strong>
        {claim.recommendedClaimEveryMinutes != null ? (
          <p className="gemsRtBig">Claim freebies and lootbugs every ~{Math.max(1, Math.floor(claim.recommendedClaimEveryMinutes))} min</p>
        ) : (
          <p className="fv2Muted">No bank size is configured, so there is no claim deadline. Claim whenever you like.</p>
        )}
        <div className="gemsRtRow">
          <span>Freebie bank full in <b>{claim.freebieBankFillMinutes != null ? fmtMin(claim.freebieBankFillMinutes) : "n/a"}</b> ({claim.freebiesPerHour.toFixed(1)}/h)</span>
          <span>Lootbug bank full in <b>{claim.lootbugBankFillMinutes != null ? fmtMin(claim.lootbugBankFillMinutes) : "n/a"}</b> ({claim.lootbugSpawnsPerHour.toFixed(1)} spawns/h)</span>
        </div>
        {claim.freebieBankFillMinutes != null || claim.lootbugBankFillMinutes != null ? (
          <>
            <p className="gemsDrNote">Once a bank is full, new freebies or spawns are lost. Estimated loss if you claim only this often:</p>
            <div className="gemsRtTableWrap">
              <table className="gemsRtTable">
                <thead><tr><th>Claim every</th>{WAITS.map((w) => <th key={w}>{fmtMin(w)}</th>)}</tr></thead>
                <tbody><tr><td>Gems lost/h</td>{WAITS.map((w) => { const x = lossAt(w); return <td key={w} className={x > 0.5 ? "fv2Bad" : "fv2Good"}>{x > 0.5 ? fmtGems(-x) : "0"}</td>; })}</tr></tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      <div className="fv2Card">
        <strong>Overnight / away</strong>
        <div className="fv2Tabs" role="tablist" style={{ margin: "8px 0" }}>
          {hoursList.map((h) => (
            <button key={h} type="button" role="tab" aria-selected={h === hours} className={`fv2Tab ${h === hours ? "fv2TabActive" : ""}`} onClick={() => setHours(h)}>{h} h</button>
          ))}
        </div>
        <div className="gemsRtCmp">
          <div className={`gemsRtCmpBox ${!unfuelBetter ? "gemsRtCmpBest" : ""}`}>
            <div className="fv2Muted">Gem drones as set</div>
            <div className="gemsRtBig">{fmtGems(fueledNow, true)}</div>
            <div className="gemsDrNote">{fmtGems(afk.netPerHourAfk)}/h net</div>
          </div>
          <div className={`gemsRtCmpBox ${unfuelBetter ? "gemsRtCmpBest" : ""}`}>
            <div className="fv2Muted">Unfueled</div>
            <div className="gemsRtBig">{fmtGems(unfueled, true)}</div>
            <div className="gemsDrNote">{fmtGems(afk.netPerHourAfkUnfueled)}/h net</div>
          </div>
        </div>
        <p className="gemsDrVerdict">
          {unfuelBetter && afkDrones.length ? (
            <span className="fv2Warn">Before sleeping: unfuel {afkDrones.join("/")} (+{fmtGems(gainUnfuel)} gems over {hours} h).</span>
          ) : (
            <span className="fv2Good">Leave fuel as is: your gem drones earn more than they cost while you are away{gainUnfuel < -0.5 ? ` (${fmtGems(-gainUnfuel)} gems over ${hours} h)` : ""}.</span>
          )}
        </p>
        <p className="gemsRtRow">
          <span>Banks on waking: <b>{fmtGems(banked, true)}</b> gems</span>
          <span className="fv2Muted">({fmtGems(afk.bankedFreebiesGems)} freebies + {fmtGems(afk.bankedLootbugsGems)} lootbugs, paid once; banks stop growing when full)</span>
        </p>
        <p className="gemsDrNote">
          Total for the night: {fmtGems((unfuelBetter ? unfueled : fueledNow) + banked, true)} gems. {afk.note}
        </p>
      </div>

      <div className="fv2Card">
        <strong>Today</strong>
        <p className="gemsRtToday">{today.length ? today.join(" · ") : "Nothing to change: your current setup is already the best option the model sees."}</p>
      </div>
    </section>
  );
}
