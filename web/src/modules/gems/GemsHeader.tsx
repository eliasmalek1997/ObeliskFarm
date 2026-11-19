import type { GemSectionProps } from "./types";
import "./summary.css";

const STEPS = [
  "Import your stats from the menu.",
  'Check your gems per hour and "Do this next".',
  "Follow the routine below.",
];

export function GemsHeader({ snapshot }: GemSectionProps) {
  const fixed = snapshot.sources.filter((s) => s.fixed);
  return (
    <section className="fv2Section">
      <div className="header" style={{ padding: 0 }}>
        <h1 className="title">Gem Farming</h1>
        <div className="subtitle">Where your gems come from and how to get more, fastest.</div>
      </div>
      <div className="fv2Card">
        <div className="fv2SectionTitle" style={{ fontSize: 15, marginBottom: 8 }}>
          How to use this page
        </div>
        <ol className="fv2Steps gemsHeadHow">
          {STEPS.map((s, i) => (
            <li className="fv2Step" key={i}>
              <span className="fv2StepNum">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="fv2Muted" style={{ fontSize: 13 }}>
        Inputs come from Gem EV, Bombs, Lootbug, Drone and Items — edit them there; this page only adds what-ifs.
      </div>
      <details className="gemsHeadDetails">
        <summary>What's different from the Gem EV calculator</summary>
        {fixed.length === 0 ? (
          <div className="fv2Muted" style={{ marginTop: 8 }}>No differences for your current setup.</div>
        ) : (
          <ul className="gemsHeadList">
            {fixed.map((s) => (
              <li key={s.id}>
                <strong>{s.label}</strong>
                {s.note ? <span className="fv2Muted"> — {s.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
