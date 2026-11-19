import type { Dispatch, SetStateAction } from "react";
import type { GemInputs, GemOverrides } from "../../lib/gems/inputs";
import type { GemSnapshot } from "../../lib/gems/model";
import type { GemLever } from "../../lib/gems/levers";

/** Props every section of the Gems page receives. The shell owns overrides; sections call setOverrides. */
export type GemSectionProps = {
  inputs: GemInputs;
  overrides: GemOverrides;
  setOverrides: Dispatch<SetStateAction<GemOverrides>>;
  snapshot: GemSnapshot;
  levers: GemLever[];
};
