import { formatCostCompact } from "../../../lib/format";
import { fishIconUrl, getFishById } from "../../../lib/fishing/constants";
import type { RankedPurchase } from "../../../lib/fishing/ranking";

export function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return "n/a";
  if (h < 1) return `~${Math.max(1, Math.round(h * 60))} min`;
  if (h < 10) return `~${h.toFixed(1)} h`;
  if (h < 48) return `~${Math.round(h)} h`;
  const d = h / 24;
  return d < 10 ? `~${d.toFixed(1)} days` : `~${Math.round(d)} days`;
}

export function fmtPct(p: number): string {
  if (p >= 10) return p.toFixed(1);
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(3);
}

export function fishName(id: string | undefined): string {
  return (id && getFishById(id)?.name) || id || "fish";
}

export function fishIcon(id: string | undefined): string | null {
  const f = id ? getFishById(id) : undefined;
  return f ? fishIconUrl(f.iconFile) : null;
}

export function costText(p: RankedPurchase): string {
  const a = formatCostCompact(p.cost.amount);
  if (p.cost.currency === "fish") return `${a} ${fishName(p.cost.fishId)}`;
  if (p.cost.currency === "gems") return `${a} gems`;
  return `${a} skill point${p.cost.amount === 1 ? "" : "s"}`;
}

/** Best hours estimate for a row, or null if unknown. */
export function rowHours(p: RankedPurchase): number | null {
  return p.hoursToAfford;
}
