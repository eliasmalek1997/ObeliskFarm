import type { ReactNode } from "react";
import { Tooltip } from "../../../components/Tooltip";

/** Clamp + truncate helper for integer inputs. */
export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

type Common = {
  label: string;
  hint?: string;
  icon?: string;
};

function Label({ label, hint, icon, extra }: Common & { extra?: ReactNode }) {
  return (
    <div className="fv2SetupLabel">
      {icon ? <img className="fv2SetupIcon" src={icon} alt="" loading="lazy" /> : null}
      <span className="fv2SetupName">{label}</span>
      {hint ? <Tooltip content={{ title: label, lines: [hint] }} /> : null}
      {extra}
    </div>
  );
}

/** Row with label, -/+ stepper, typed input and optional Max button. */
export function StepperRow(
  props: Common & {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    decimals?: boolean;
    note?: string;
  },
) {
  const { value, onChange, min = 0, max = Infinity, step = 1, decimals = false, note } = props;
  const set = (v: number) => {
    const c = Number.isFinite(v) ? Math.max(min, Math.min(max, decimals ? v : Math.trunc(v))) : min;
    onChange(decimals ? Math.round(c * 1000) / 1000 : c);
  };
  return (
    <div className="fv2SetupRow">
      <Label {...props} extra={note ? <span className="fv2Muted fv2SetupNote">{note}</span> : null} />
      <div className="fv2SetupCtl">
        <button type="button" className="fv2SetupBtn" aria-label={`Decrease ${props.label}`} disabled={value <= min} onClick={() => set(value - step)}>
          −
        </button>
        <input
          className="fv2SetupInput"
          type="number"
          inputMode="decimal"
          min={min}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          value={value}
          aria-label={props.label}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button type="button" className="fv2SetupBtn" aria-label={`Increase ${props.label}`} disabled={value >= max} onClick={() => set(value + step)}>
          +
        </button>
        {Number.isFinite(max) ? (
          <button type="button" className="fv2SetupBtn fv2SetupMax" disabled={value >= max} onClick={() => set(max)} title={`Set to max (${max})`}>
            max {max}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ToggleRow(props: Common & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="fv2SetupRow">
      <Label {...props} />
      <div className="fv2SetupCtl">
        <button
          type="button"
          role="switch"
          aria-checked={props.value}
          className={`fv2SetupBtn fv2SetupToggle${props.value ? " fv2SetupOn" : ""}`}
          onClick={() => props.onChange(!props.value)}
        >
          {props.value ? "Yes" : "No"}
        </button>
      </div>
    </div>
  );
}

/** Row with a segmented choice. */
export function ChoiceRow<T extends string | number>(
  props: Common & { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void },
) {
  return (
    <div className="fv2SetupRow">
      <Label {...props} />
      <div className="fv2SetupCtl fv2SetupSeg" role="group" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={`fv2SetupBtn${o.value === props.value ? " fv2SetupOn" : ""}`}
            aria-pressed={o.value === props.value}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Group(props: { title: string; blurb?: string; children: ReactNode }) {
  return (
    <div className="fv2SetupGroup">
      <h4 className="fv2SetupGroupTitle">{props.title}</h4>
      {props.blurb ? <p className="fv2Muted fv2SetupBlurb">{props.blurb}</p> : null}
      {props.children}
    </div>
  );
}
