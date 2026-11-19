import { useEffect, useMemo, useState } from "react";
import "./fishingv2.css";
import { loadFishingState, saveFishingState, type FishingState } from "../../lib/fishing/state";
import { buildFishingContext, computeFishingSnapshot } from "../../lib/fishing/model";
import { rankPurchases } from "../../lib/fishing/ranking";
import { readFishingExternal, readGemsPerHour } from "../../lib/fishing/external";
import type { FishingSectionProps } from "./types";
import { Summary } from "./Summary";
import { BuyNext } from "./BuyNext";
import { Docks } from "./Docks";
import { Setup } from "./Setup";
import { PageHeader } from "./PageHeader";

/**
 * New Fishing page. Shares the classic module's saved state (same storage key and shape),
 * so switching between "Fishing" and "Fishing (classic)" keeps the same inputs.
 */
export function FishingPage() {
  const [state, setState] = useState<FishingState>(() => loadFishingState());

  useEffect(() => {
    const t = window.setTimeout(() => saveFishingState(state), 250);
    return () => window.clearTimeout(t);
  }, [state]);

  // Other modules (Drone, Lootbug, Gem EV) write these; read once per mount.
  const external = useMemo(() => readFishingExternal(), []);
  const gemsPerHour = useMemo(() => readGemsPerHour(), []);

  const ctx = useMemo(() => buildFishingContext(state, external, gemsPerHour), [state, external, gemsPerHour]);
  const snapshot = useMemo(() => computeFishingSnapshot(state, ctx), [state, ctx]);
  const ranked = useMemo(() => rankPurchases(state, ctx), [state, ctx]);

  const props: FishingSectionProps = { state, setState, snapshot, ranked, ctx, gemsPerHour };

  return (
    <div className="container fv2">
      <PageHeader {...props} />
      <Summary {...props} />
      <BuyNext {...props} />
      <Docks {...props} />
      <Setup {...props} />
    </div>
  );
}
