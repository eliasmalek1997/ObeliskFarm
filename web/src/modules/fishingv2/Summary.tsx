import { Tooltip } from "../../components/Tooltip";
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
  return "Locked";
}

export function Summary({ snapshot, ranked }: FishingSectionProps) {
  const st = snapshot.stats;
  const top = fishTrack([...ranked])[0];
  const docks = snapshot.docks.filter((d) => d.unlocked);

  let takeaway = "Nothing left to buy with fish right now.";
  if (top) {
    const lvl = top.structural ? "" : ` L${top.toLevel}`;
    const hrs = top.hoursToAfford ?? top.hoursIfFocused;
    const when =
      hrs != null
        ? `~${fmtHours(hrs).replace("~", "")} of ${fishName(top.cost.fishId)}`
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
