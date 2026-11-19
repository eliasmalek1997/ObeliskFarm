import type { Dispatch, SetStateAction } from "react";
import type { FishingState } from "../../lib/fishing/state";
import type { FishingContext, FishingSnapshot } from "../../lib/fishing/model";
import type { FishInventory } from "../../lib/fishing/inventory";
import type { RankedPurchase } from "../../lib/fishing/ranking";

/** Props every section of the new Fishing page receives. The shell owns state; sections only call setState. */
export type FishingSectionProps = {
  state: FishingState;
  setState: Dispatch<SetStateAction<FishingState>>;
  snapshot: FishingSnapshot;
  ranked: RankedPurchase[];
  ctx: FishingContext;
  gemsPerHour: number;
  /** Owned fish counts (feeds every time estimate). */
  inventory: FishInventory;
  setInventory: Dispatch<SetStateAction<FishInventory>>;
};
