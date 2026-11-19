import { useId, useState, type ReactNode } from "react";
import { GLOSSARY } from "./glossary";

/** Inline term with dotted underline; tap/click or focus toggles the definition. Hover shows it via title. */
export function Term(props: { id: string; children?: ReactNode }) {
  const entry = GLOSSARY[props.id];
  const [open, setOpen] = useState(false);
  const tipId = useId();
  if (!entry) return <>{props.children}</>;
  return (
    <>
      <button
        type="button"
        className="fv2Term"
        title={entry.def}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {props.children ?? entry.term}
      </button>
      {open && (
        <span id={tipId} role="tooltip" className="fv2TermTip">
          {entry.def}
        </span>
      )}
    </>
  );
}

/** Collapsible list of every glossary term. */
export function GlossaryPanel(props: { defaultOpen?: boolean }) {
  return (
    <details className="fv2Card fv2Gloss" open={props.defaultOpen}>
      <summary>Glossary: what do these words mean?</summary>
      <dl style={{ margin: 0 }}>
        {Object.entries(GLOSSARY).map(([id, e]) => (
          <div key={id}>
            <dt>{e.term}</dt>
            <dd>{e.def}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
