import { useEffect, useMemo, useState } from "react";
import type { FishingSectionProps } from "./types";
import { getFishById } from "../../lib/fishing";
import { GEMS_PER_SKILL_POINT } from "../../lib/fishing/model";
import { gemTrack } from "../../lib/fishing/ranking";
import { nextUpgradeTarget } from "../../lib/fishing/sushi";
import { loadJson, saveJson } from "../../lib/storage";
import {
  LOOTBUG_BUFF_OBELISK_REQ,
  anglerStats,
  enhancementGemsPerTick,
  fishPerTick,
  fuelAdvice,
  lootbugAdvice,
  lootbugBuff,
  normalTicksPerHour,
  oneBuyFinishes,
} from "../../lib/fishing/boosts";
import "./boosts.css";

const KEY = "obeliskfarm:web:fishing_boosts.json";
const DRONE_KEY = "obeliskfarm:web:drone_elixir_save.json:v9";
const LOOTBUG_KEY = "obeliskfarm:web:lootbug_save.json:v1";
const GEMEV_KEY = "obeliskfarm:web:gemev_save.json:v1";
const HORIZONS = [7, 30, 90];

type DroneSave = {
  anglerDroneOn?: boolean; anglerSuitLevel?: number; anglerGradeLevel?: number; anglerFueled?: boolean;
  gameSpeedMultiplier?: number; fuelDurationUpgradeLevel?: number; fuelSaveChanceUpgradeLevel?: number;
  upgradeFuelSaveChancePct?: number; fuelDurationWorld3Level?: number; fuelDurationRelicLevel?: number;
  gasolineGuzzler?: boolean; axolotlSkin?: boolean; platinumStatueOfAppetite?: boolean; miscFuelCardTier?: number;
};
type Overrides = { suit?: number; grade?: number; slotFree?: boolean; horizon?: number };

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  if (a >= 100) return n.toFixed(0);
  return n.toFixed(1);
}
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function Boosts(props: FishingSectionProps) {
  const { snapshot, ranked, gemsPerHour } = props;
  const [ov, setOv] = useState<Overrides>(() => loadJson<Overrides>(KEY) ?? {});
  useEffect(() => saveJson(KEY, ov), [ov]);

  const drone = useMemo(() => loadJson<DroneSave>(DRONE_KEY) ?? {}, []);
  const lootbug = useMemo(() => loadJson<{ gemCostReduction?: number; lootMultiplier?: number }>(LOOTBUG_KEY) ?? {}, []);
  const obelisk = useMemo(() => {
    const v = loadJson<{ params?: { obelisk_level?: number } }>(GEMEV_KEY)?.params?.obelisk_level;
    return typeof v === "number" ? v : null;
  }, []);

  const suit = ov.suit ?? num(drone.anglerSuitLevel, 0);
  const grade = ov.grade ?? num(drone.anglerGradeLevel, 0);
  const slotFree = ov.slotFree ?? true;
  const horizon = ov.horizon ?? 30;
  const speed = Math.max(1, num(drone.gameSpeedMultiplier, 1));

  const a = anglerStats({ ...drone, suitLevel: suit, gradeLevel: grade, gameSpeed: speed });
  const lb = lootbugBuff(num(lootbug.gemCostReduction, 0), num(lootbug.lootMultiplier, 1));
  const nTph = normalTicksPerHour(snapshot.stats.effectiveTickSeconds);
  const fpt = fishPerTick(snapshot.totalFishPerHour, nTph);

  const best = useMemo(() => {
    // Compare against permanent upgrades measured on the same basis as total fishing (top-dock).
    // Fish card gilds are scored on their own dock only, so their % isn't comparable here.
    let bestP: { gemsPerTick: number; name: string } | null = null;
    for (const p of gemTrack(ranked, gemsPerHour)) {
      if (p.kind === "fishCard" || p.basis !== "top-dock" || !(p.gainPct > 0) || !(p.cost.amount > 0)) continue;
      const gems = p.cost.amount * (p.cost.currency === "skillPoints" ? GEMS_PER_SKILL_POINT : 1);
      const gpt = enhancementGemsPerTick(gems, p.gainPct, nTph, horizon * 24);
      if (!bestP || gpt < bestP.gemsPerTick) bestP = { gemsPerTick: gpt, name: `${p.name} L${p.toLevel}` };
    }
    return bestP;
  }, [ranked, gemsPerHour, nTph, horizon]);

  const fuel = fuelAdvice(a.fuelGemsPerTick, best);
  const buy = lootbugAdvice(lb.gemsPerTick, best);
  const target = useMemo(() => nextUpgradeTarget(ranked), [ranked]);
  const targetFpt = target && nTph > 0 ? (snapshot.fishRates[target.fishId] ?? 0) / nTph : 0;
  const finishes = target ? oneBuyFinishes(lb.ticksPerPurchase, targetFpt, target.remaining) : false;
  const fishName = target ? getFishById(target.fishId)?.name ?? target.fishId : "";
  const locked = obelisk != null && obelisk < LOOTBUG_BUFF_OBELISK_REQ;
  const pct = nTph > 0 ? (a.baseTicksPerHour / nTph) * 100 : 0;
  const set = (p: Overrides) => setOv((o) => ({ ...o, ...p }));
  const numIn = (label: string, v: number, max: number, key: "suit" | "grade") => (
    <label className="fv2Muted">{label}{" "}
      <input className="fv2BoostsInput" type="number" inputMode="numeric" min={0} max={max} value={v}
        onChange={(e) => set({ [key]: Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))) })} />
    </label>
  );

  return (
    <section className="fv2Section" aria-label="Boosts">
      <h2 className="fv2SectionTitle">Boosts</h2>
      <div className="fv2Card">
        <div className="fv2BoostsRow">
          {numIn("Angler suit level", suit, 20, "suit")}
          {numIn("Grade", grade, 100, "grade")}
          <label className="fv2Muted"><input type="checkbox" checked={slotFree} onChange={(e) => set({ slotFree: e.target.checked })} /> Drone slot free</label>
        </div>
        <div className="fv2BoostsRow">
          <span className="fv2Muted">Gem horizon</span>
          <div className="fv2Tabs" role="tablist">
            {HORIZONS.map((h) => (
              <button key={h} type="button" role="tab" aria-selected={horizon === h} className={`fv2Tab${horizon === h ? " fv2TabActive" : ""}`} onClick={() => set({ horizon: h })}>{h} d</button>
            ))}
          </div>
        </div>
      </div>

      <div className="fv2BoostsGrid">
        <div className="fv2Card">
          <strong>Angler Drone</strong>
          <div className={`fv2BoostsVerdict ${slotFree ? "fv2Good" : "fv2Warn"}`}>
            {slotFree ? "Run it whenever you have a free drone slot." : "No free slot: compare against your other drones in the Drone module first."}
          </div>
          <div className="fv2BoostsLine">One cycle every {a.intervalSecReal.toFixed(0)} s real time (game speed {Number(speed).toFixed(2)}x).</div>
          <div className="fv2BoostsLine">+{fmt(a.baseTicksPerHour)} ticks/h = +{pct.toFixed(1)}% fishing = +{fmt(a.baseTicksPerHour * fpt)} fish/h (no gem cost).</div>
          <div className="fv2BoostsLine fv2Muted">Unlock requirement: not in the app's data.</div>
          <hr />
          <strong>Fuel</strong>
          <div className={`fv2BoostsVerdict ${fuel.go ? "fv2Good" : "fv2Warn"}`}>{fuel.text}</div>
          <div className="fv2BoostsLine">+{fmt(a.buffTicksPerHour)} ticks/h (1% per cycle, {a.buffTicksPerProc} ticks) for {fmt(a.fuelGemsPerHour)} gems/h.</div>
        </div>

        <div className="fv2Card">
          <strong>Lootbug: Fishing +12 Ticks</strong>
          <div className="fv2BoostsLine">Cost {lb.effectiveCost} gems for ~{lb.ticksPerPurchase.toFixed(1)} ticks = {lb.gemsPerTick.toFixed(2)} gems/tick, about {fmt(lb.ticksPerPurchase * fpt)} fish per purchase.</div>
          {finishes && target ? (
            <div className="fv2BoostsVerdict fv2Good">Buy now: one purchase finishes {target.label} ({fishName}).</div>
          ) : (
            <div className={`fv2BoostsVerdict ${buy.go ? "fv2Good" : "fv2Warn"}`}>{buy.text}</div>
          )}
          {obelisk != null && (
            <div className={`fv2BoostsLine ${locked ? "fv2Warn" : "fv2Muted"}`}>
              Requires Obelisk Lvl {LOOTBUG_BUFF_OBELISK_REQ}{locked ? `; you are at ${obelisk}, so it unlocks in ${LOOTBUG_BUFF_OBELISK_REQ - obelisk} more levels.` : " (met)."}
            </div>
          )}
          {obelisk == null && <div className="fv2BoostsLine fv2Muted">Requires Obelisk Lvl {LOOTBUG_BUFF_OBELISK_REQ}.</div>}
        </div>
      </div>
      <p className="fv2Muted" style={{ fontSize: 12 }}>Angler and Lootbug numbers come from the app's game data; not yet re-verified against the wiki.</p>
    </section>
  );
}
