import { applyDroneOverrides } from "../../lib/gems/model";
import { DRONE_DEFS, droneDef, droneFuelCostGemsPerHour, type DroneId, type ElixirState } from "../../lib/drone/model";
import { GEM_BUFFS } from "../../lib/lootbug/constants";
import type { GemSectionProps } from "./types";
import type { GemLever } from "../../lib/gems/levers";

const CARDS: DroneId[] = ["elixir", "frogger", "bear", "angler"];
const BUY_LEVER_NAMES = ["10x Bomb Recharge", "+100 Cherry Charges", "+3 Item Chests"];

export function fmtGems(n: number, signed = false): string {
  if (!Number.isFinite(n)) return "n/a";
  const a = Math.abs(n);
  const s = a >= 100 ? a.toFixed(0) : a.toFixed(1);
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  return sign + s;
}

function leverById(levers: GemLever[], id: string): GemLever | undefined {
  return levers.find((l) => l.id === id);
}

export function GemsDrones({ inputs, overrides, setOverrides, snapshot, levers }: GemSectionProps) {
  const eff = applyDroneOverrides(inputs.drone, overrides);
  const rec = eff as unknown as Record<string, unknown>;
  const gs = snapshot.rates.gameSpeedForTime;
  const cycle = snapshot.rates.bombCycle;

  const setDrone = (key: "droneOn" | "droneFuel", id: DroneId, v: boolean) =>
    setOverrides((o) => ({ ...o, [key]: { ...o[key], [id]: v } }));
  const resetDrone = (id: DroneId) =>
    setOverrides((o) => {
      const on = { ...o.droneOn };
      const fu = { ...o.droneFuel };
      delete on[id];
      delete fu[id];
      return { ...o, droneOn: on, droneFuel: fu };
    });

  const card = (id: DroneId) => {
    const def = droneDef(id);
    const on = Boolean(rec[def.on as string]);
    const fueled = Boolean(rec[def.fueled as string]);
    const lever = leverById(levers, `fuel_${id}`);
    const fuelCost = droneFuelCostGemsPerHour(id, { ...eff, [def.fueled]: true } as ElixirState, gs);
    const hasOverride = overrides.droneOn?.[id] !== undefined || overrides.droneFuel?.[id] !== undefined;
    const cycleLbl = cycle === "late" ? "Late" : "Early";

    // Net effect of FUELING the drone (benefit minus fuel) in gems/h.
    let netFuel: number | null = null;
    if (lever) netFuel = fueled ? -lever.deltaNetPerHour : lever.deltaNetPerHour;

    let verdict = "";
    let tone = "fv2Muted";
    let gross: number | null = null;
    if (!on) {
      verdict = "Not equipped.";
    } else if (id === "angler") {
      verdict = "Angler gives fishing ticks, not gems. Its fuel is not counted against gems.";
    } else if (netFuel != null) {
      gross = netFuel + fuelCost;
      const m = fmtGems(Math.abs(netFuel));
      if (fueled) {
        if (netFuel >= 0) { verdict = `Keep fueled (+${m}/h on ${cycleLbl} cycle)`; tone = "fv2Good"; }
        else { verdict = `Unfuel: fuel costs more than it earns (+${m}/h)`; tone = "fv2Warn"; }
      } else if (netFuel > 0) { verdict = `Fuel it (+${m}/h on ${cycleLbl} cycle)`; tone = "fv2Good"; }
      else { verdict = `Leave unfueled (fueling would lose ${m}/h)`; }
    }

    const extra =
      id === "elixir"
        ? "Elixir's 2x game speed buff isn't valued here, so this understates it."
        : id === "frogger"
          ? `Frogger's bombs depend on the bomb cycle: it pays for its fuel on Late; on Early it fires fewer useful bombs. Current cycle: ${cycleLbl}.`
          : id === "bear"
            ? "Bomb Bear raises Lootbug spawn rate (a spawn-rate gain, counted in the Lootbug lines)."
            : "Angler's value is fishing ticks and is counted on the Fishing page.";

    return (
      <div className="fv2Card gemsDrCard" key={id}>
        <div className="gemsDrHead">
          <span className="gemsDrName">{def.label}</span>
          <span>
            <span className={`fv2Chip ${on ? "fv2Good" : ""}`}>{on ? "Equipped" : "Off"}</span>{" "}
            <span className={`fv2Chip ${on && fueled ? "fv2Good" : ""}`}>{fueled ? "Fueled" : "Unfueled"}</span>
            {hasOverride ? <> <span className="fv2Chip fv2Warn">what-if</span></> : null}
          </span>
        </div>
        {on && id !== "angler" ? (
          <div className="gemsDrStats">
            <div className="gemsDrStat"><div className="gemsDrStatVal">{gross != null ? fmtGems(gross, true) : "n/a"}</div><div className="gemsDrStatLbl">gems/h added</div></div>
            <div className="gemsDrStat"><div className="gemsDrStatVal">{fmtGems(-fuelCost)}</div><div className="gemsDrStatLbl">fuel gems/h</div></div>
            <div className="gemsDrStat"><div className={`gemsDrStatVal ${netFuel != null ? (netFuel >= 0 ? "fv2Good" : "fv2Bad") : ""}`}>{netFuel != null ? fmtGems(netFuel, true) : "n/a"}</div><div className="gemsDrStatLbl">net gems/h</div></div>
          </div>
        ) : null}
        {verdict ? <p className={`gemsDrVerdict ${tone}`}>{verdict}</p> : null}
        <p className="gemsDrNote">{extra}</p>
        <div className="gemsDrToggles">
          <label className="gemsDrCheck"><input type="checkbox" checked={on} onChange={(e) => setDrone("droneOn", id, e.target.checked)} />On</label>
          <label className="gemsDrCheck"><input type="checkbox" checked={fueled} onChange={(e) => setDrone("droneFuel", id, e.target.checked)} />Fuel</label>
          {hasOverride ? <button type="button" className="gemsDrReset" onClick={() => resetDrone(id)}>Reset to saved</button> : null}
        </div>
      </div>
    );
  };

  const swaps = levers.filter((l) => l.id.startsWith("swap_"));
  const otherFuel = snapshot.nonGemCosts;
  const buying = new Set(overrides.lootbugBuy ?? inputs.lootbug.activeGemBuffs);
  const reduction = inputs.lootbug.gemCostReduction;
  const toggleBuy = (name: string, v: boolean) =>
    setOverrides((o) => {
      const cur = new Set(o.lootbugBuy ?? inputs.lootbug.activeGemBuffs);
      if (v) cur.add(name); else cur.delete(name);
      return { ...o, lootbugBuy: [...cur] };
    });
  const buyOverridden = overrides.lootbugBuy != null;
  const unvalued = GEM_BUFFS.filter((b) => !BUY_LEVER_NAMES.includes(b.name));

  return (
    <section className="fv2Section">
      <div className="fv2SectionHead">
        <h2 className="fv2SectionTitle">Drones &amp; Lootbug</h2>
        <span className="fv2Muted">Toggles are what-ifs; your saved modules are untouched.</span>
      </div>

      <div className="fv2Grid">{CARDS.map(card)}</div>

      {swaps.length ? (
        <div className="fv2Card">
          <strong>Swapping drones</strong>
          <ul className="gemsDrSwaps">
            {swaps.map((l) => (
              <li key={l.id}>
                {l.label}: <span className={l.deltaNetPerHour >= 0 ? "fv2Good" : "fv2Bad"}>{fmtGems(l.deltaNetPerHour, true)}/h</span>
                {l.note ? <span className="fv2Muted"> ({l.note})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="gemsDrNote">
        Not gem drones: {DRONE_DEFS.filter((d) => !d.gemRelevant && d.id !== "angler").map((d) => d.label).join(", ")}.
        Their fuel isn't subtracted from gems
        {otherFuel.length ? ` (it would cost ${fmtGems(otherFuel.reduce((s, x) => s + x.gemsPerHour, 0))} gems/h if fueled)` : ""}.
      </p>

      <h3 className="fv2SectionTitle" style={{ fontSize: 16 }}>Lootbug gem buffs</h3>
      <div className="fv2Card">
        <ul className="gemsDrList">
          {BUY_LEVER_NAMES.map((name) => {
            const buff = GEM_BUFFS.find((b) => b.name === name);
            if (!buff) return null;
            const lever = leverById(levers, `lootbug_buy_${name}`);
            const has = buying.has(name);
            const buyValue = lever ? (has ? -lever.deltaNetPerHour : lever.deltaNetPerHour) : null;
            const worth = buyValue != null && buyValue > 0;
            return (
              <li key={name} className="gemsDrRow">
                <label className="gemsDrCheck gemsDrRowMain">
                  <input type="checkbox" checked={has} onChange={(e) => toggleBuy(name, e.target.checked)} />
                  <span>{name} <span className="fv2Muted">({Math.max(0, buff.cost - reduction)} gems each)</span></span>
                </label>
                {buyValue != null ? (
                  <span className={worth ? "fv2Good" : "fv2Bad"}>
                    {worth ? "Worth buying" : "Don't buy"} ({fmtGems(buyValue, true)}/h net of cost)
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {buyOverridden ? (
          <button type="button" className="gemsDrReset" onClick={() => setOverrides((o) => ({ ...o, lootbugBuy: null }))}>Reset to saved</button>
        ) : null}
        <p className="gemsDrNote">
          Golden lootbugs still give these for free, so collect those. {unvalued.map((b) => b.name).join(", ")} have no gem value in this model
          (2x Game Speed in particular may be worth buying, but it isn't valued).
        </p>
      </div>
    </section>
  );
}
