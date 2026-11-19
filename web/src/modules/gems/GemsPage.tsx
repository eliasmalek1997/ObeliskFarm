import { useEffect, useMemo, useState } from "react";
import "../fishingv2/fishingv2.css";
import "./gems.css";
import { readGemInputs, loadGemOverrides, saveGemOverrides, type GemOverrides } from "../../lib/gems/inputs";
import { computeGemSnapshot } from "../../lib/gems/model";
import { rankGemLevers } from "../../lib/gems/levers";
import type { GemSectionProps } from "./types";
import { GemsHeader } from "./GemsHeader";
import { GemsSummary } from "./GemsSummary";
import { GemsLevers } from "./GemsLevers";
import { GemsDrones } from "./GemsDrones";
import { GemsRoutine } from "./GemsRoutine";

/**
 * Gem farming page. Reads every module's saved inputs once per mount and computes gems/h in one place
 * (lib/gems). Page-only settings (what-ifs, prices) live in their own key via GemOverrides.
 */
export function GemsPage() {
  const inputs = useMemo(() => readGemInputs(), []);
  const [overrides, setOverrides] = useState<GemOverrides>(() => loadGemOverrides());
  useEffect(() => {
    const t = window.setTimeout(() => saveGemOverrides(overrides), 250);
    return () => window.clearTimeout(t);
  }, [overrides]);

  const snapshot = useMemo(() => computeGemSnapshot(inputs, overrides), [inputs, overrides]);
  const levers = useMemo(() => rankGemLevers(inputs, overrides), [inputs, overrides]);
  const props: GemSectionProps = { inputs, overrides, setOverrides, snapshot, levers };

  return (
    <div className="container fv2 gemsPage">
      <GemsHeader {...props} />
      <GemsSummary {...props} />
      <GemsLevers {...props} />
      <GemsDrones {...props} />
      <GemsRoutine {...props} />
    </div>
  );
}
