import { useMemo, useState } from "react";
import { Tooltip } from "../../components/Tooltip";
import { fishTrack, gemTrack, type RankedPurchase } from "../../lib/fishing/ranking";
import type { FishingSectionProps } from "./types";
import { costText, fishIcon, fmtHours, fmtPct } from "./buynext/helpers";
import "./buynext.css";

type Tab = "fish" | "gems";
const DEFAULT_SHOWN = 8;

function valueOf(p: RankedPurchase, tab: Tab): number {
  if (tab === "fish") return p.gainPctPerHour ?? p.gainPctPerHourFocused ?? 0;
  return p.gainPctPerHour ?? p.gainPctPerKGem ?? 0;
}

export function BuyNext({ state, setState, ranked, gemsPerHour }: FishingSectionProps) {
  const [tab, setTab] = useState<Tab>("fish");
  const [all, setAll] = useState(false);

  const rows = useMemo(
    () => (tab === "fish" ? fishTrack([...ranked]) : gemTrack([...ranked], gemsPerHour)),
    [ranked, tab, gemsPerHour],
  );
  void state;
  const shown = all ? rows : rows.slice(0, DEFAULT_SHOWN);
  const gemsPerKey = tab === "gems" && !(gemsPerHour > 0);
  const best = Math.max(1e-12, ...shown.map((p) => valueOf(p, tab)));

  const markBought = (p: RankedPurchase) => {
    setState((s) => {
      if (p.kind === "upgrade") return { ...s, upgradeLevels: { ...s.upgradeLevels, [p.id]: p.toLevel } };
      if (p.kind === "enhancement") return { ...s, enhanceLevels: { ...s.enhanceLevels, [p.id]: p.toLevel } };
      if (p.kind === "skill") return { ...s, skillTreeLevels: { ...s.skillTreeLevels, [p.id]: p.toLevel } };
      return s;
    });
  };

  return (
    <section className="fv2Section">
      <h2 className="fv2SectionTitle">
        What to buy next{" "}
        <Tooltip
          content={{
            title: "How this is ranked",
            lines: [
              "Gain per hour of farming: how much more fish per hour you get, divided by how many hours it takes to earn the price. Higher is a better buy.",
              "Boats do not add fish themselves. They are valued by the upgrades and docks they unlock.",
            ],
          }}
        />
      </h2>
      <div className="fv2BuyTabs" role="tablist">
        {(["fish", "gems"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`fv2BuyTab${tab === t ? " fv2BuyTabOn" : ""}`}
            onClick={() => {
              setTab(t);
              setAll(false);
            }}
          >
            {t === "fish" ? "With fish" : "With gems"}
          </button>
        ))}
      </div>
      {gemsPerKey && (
        <div className="fv2Muted fv2BuyHint">
          Gem times need your gem income: fill in the Gem EV module. Until then, rows are ranked by % gain per 1000 gems.
        </div>
      )}
      {rows.length === 0 && <div className="fv2Muted">Nothing to buy in this list.</div>}
      <div className="fv2BuyList">
        {shown.map((p, i) => {
          const hours = p.hoursToAfford;
          const icon = p.cost.currency === "fish" ? fishIcon(p.cost.fishId) : null;
          const canMark = p.kind !== "fishCard" && !p.structural ? true : p.structural === true;
          return (
            <div className="fv2Card fv2BuyRow" key={`${p.kind}-${p.id}-${p.toLevel}`}>
              <div className="fv2BuyTop">
                <span className="fv2BuyRank">{i + 1}</span>
                <div className="fv2BuyName">
                  <b>{p.name}</b>
                  <span className="fv2Muted">
                    {p.kind === "fishCard" ? "Gild card" : `L${p.fromLevel} → L${p.toLevel}`}
                  </span>
                </div>
                {p.structural ? (
                  <span className="fv2Chip">Unlocks</span>
                ) : (
                  <span className="fv2Good fv2BuyGain">+{fmtPct(p.gainPct)}% fish/h</span>
                )}
              </div>
              {p.structural && p.unlocks && p.unlocks.length > 0 && (
                <div className="fv2BuyUnlocks">{p.unlocks.join(", ")}</div>
              )}
              <div className="fv2BuyCost">
                <span className="fv2BuyPrice">
                  {icon && <img src={icon} alt="" width={20} height={20} loading="lazy" />}
                  {costText(p)}
                </span>
                <span className="fv2BuyTime">
                  {hours != null ? (
                    fmtHours(hours)
                  ) : p.cost.currency === "fish" ? (
                    <span className="fv2Warn">not farmed yet</span>
                  ) : (
                    <span className="fv2Muted">{fmtPct(p.gainPctPerKGem ?? 0)}% per 1000 gems</span>
                  )}
                </span>
              </div>
              <div className="fv2BuyBar" title="Value relative to the best row">
                <div style={{ width: `${Math.min(100, (valueOf(p, tab) / best) * 100)}%` }} />
              </div>
              {p.note && <div className="fv2Muted fv2BuyNote">{p.note}</div>}
              {canMark && p.kind !== "fishCard" && (
                <button className="fv2BuyMark" onClick={() => markBought(p)}>
                  Mark as bought
                </button>
              )}
            </div>
          );
        })}
      </div>
      {rows.length > DEFAULT_SHOWN && (
        <button className="fv2BuyMore" onClick={() => setAll((v) => !v)}>
          {all ? "Show top 8" : `Show all (${rows.length})`}
        </button>
      )}
    </section>
  );
}
