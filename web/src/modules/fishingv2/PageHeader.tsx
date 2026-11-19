import type { FishingSectionProps } from "./types";
import { GlossaryPanel } from "./Glossary";

const STEPS = [
  "Import your stats from the menu or fill in Your setup.",
  "Check What to buy next.",
  "Tap Mark as bought as you go.",
];

export function PageHeader(_props: FishingSectionProps) {
  return (
    <section className="fv2Section">
      <div className="header" style={{ padding: 0 }}>
        <h1 className="title">Fishing</h1>
        <div className="subtitle">See where your fish come from and what to buy next.</div>
      </div>
      <div className="fv2Card">
        <div className="fv2SectionTitle" style={{ fontSize: 15, marginBottom: 8 }}>
          How to use this page
        </div>
        <ol className="fv2Steps">
          {STEPS.map((s, i) => (
            <li className="fv2Step" key={i}>
              <span className="fv2StepNum">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="fv2Muted" style={{ fontSize: 13 }}>
        Prefer the old detailed page? It is still available as "Fishing (classic)" in the menu.
      </div>
      <GlossaryPanel />
    </section>
  );
}
