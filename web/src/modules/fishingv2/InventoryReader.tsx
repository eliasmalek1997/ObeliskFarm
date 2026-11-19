import { useRef, useState } from "react";
import { AQUARIUM, ALL_FISH, DOCKS, fishIconUrl } from "../../lib/fishing/constants";
import { fishIdAt, FISH_PER_ROW, readAquariumScreenshot } from "../../lib/fishing/screenshot";
import type { ScreenshotReading } from "../../lib/fishing/screenshot";
import "./fishingv2.css";
import "./reader.css";

const LOW_CONFIDENCE = 0.3;
const NO_GRID_MSG =
  "Could not find the fish grid. Open Fishing → Aquarium, scroll to the top, and take a screenshot.";

async function loadImageData(file: File): Promise<ImageData> {
  let w: number;
  let h: number;
  let src: CanvasImageSource;
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file);
    w = bmp.width;
    h = bmp.height;
    src = bmp;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      w = img.naturalWidth;
      h = img.naturalHeight;
      src = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(src, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

type Phase = { kind: "idle" } | { kind: "reading" } | { kind: "error"; msg: string } | { kind: "review"; reading: ScreenshotReading };

export function InventoryReader({ onApply }: { onApply: (counts: Record<string, number>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [firstDock, setFirstDock] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPhase({ kind: "reading" });
    try {
      const data = await loadImageData(file);
      // let the "reading" state paint before the synchronous pixel work
      await new Promise((r) => setTimeout(r, 0));
      const reading = readAquariumScreenshot(data);
      if (!reading) {
        setPhase({ kind: "error", msg: NO_GRID_MSG });
        return;
      }
      const v: Record<string, string> = {};
      for (const c of reading.cells) if (c.kind === "count" && c.value !== null) v[`${c.row}:${c.col}`] = String(c.value);
      setValues(v);
      setFirstDock(0);
      setPhase({ kind: "review", reading });
    } catch (e) {
      setPhase({ kind: "error", msg: `Could not read that image (${e instanceof Error ? e.message : "unknown error"}).` });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function cancel() {
    setPhase({ kind: "idle" });
    setValues({});
  }

  function apply() {
    if (phase.kind !== "review") return;
    const counts: Record<string, number> = {};
    for (const c of phase.reading.cells) {
      const txt = (values[`${c.row}:${c.col}`] ?? "").trim();
      if (!/^\d+$/.test(txt)) continue;
      const id = fishIdAt(c.row, c.col, firstDock);
      if (id) counts[id] = Number(txt);
    }
    onApply(counts);
    cancel();
  }

  const picker = (
    <div className="fv2ReaderActions">
      <button
        type="button"
        className="fv2ReaderBtn fv2ReaderBtnPrimary"
        disabled={phase.kind === "reading"}
        onClick={() => fileRef.current?.click()}
      >
        Read from screenshot
      </button>
      <input
        ref={fileRef}
        className="fv2ReaderFile"
        type="file"
        accept="image/*"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );

  if (phase.kind === "idle") return <div className="fv2Reader">{picker}</div>;
  if (phase.kind === "reading")
    return (
      <div className="fv2Reader">
        {picker}
        <div className="fv2Muted" role="status">Reading screenshot...</div>
      </div>
    );
  if (phase.kind === "error")
    return (
      <div className="fv2Reader">
        {picker}
        <div className="fv2Card fv2Warn" role="alert">{phase.msg}</div>
      </div>
    );

  const { reading } = phase;
  const rows: typeof reading.cells[] = [];
  for (const c of reading.cells) (rows[c.row] ??= []).push(c);
  const lowCount = reading.cells.filter((c) => c.kind === "count" && c.confidence < LOW_CONFIDENCE).length;
  const unreadable = reading.cells.filter((c) => c.kind === "unreadable").length;
  const maxStart = Math.max(0, AQUARIUM.length - 1);

  return (
    <div className="fv2Reader">
      <div className="fv2Card">
        <div className="fv2ReaderRow">
          <label htmlFor="fv2ReaderFirst">First row is:</label>
          <select
            id="fv2ReaderFirst"
            className="fv2ReaderSelect"
            value={firstDock}
            onChange={(e) => setFirstDock(Number(e.target.value))}
          >
            {DOCKS.slice(0, maxStart + 1).map((d, i) => (
              <option key={d.id} value={i}>{d.name}</option>
            ))}
          </select>
        </div>
        {reading.grid.topCut ? (
          <p className="fv2Warn">
            The top row looks cut off, so the grid is scrolled. Choose which dock the first full row belongs to.
          </p>
        ) : (
          <p className="fv2Muted">Defaults to Lake when the top of the panel is visible.</p>
        )}
        {(lowCount > 0 || unreadable > 0) && (
          <p className="fv2Warn">
            {lowCount + unreadable} cell(s) highlighted: check the number against your game.
          </p>
        )}
      </div>

      <div className="fv2ReaderGrid">
        {rows.map((cells, row) => {
          const dock = DOCKS[firstDock + row];
          // Rows with nothing discovered are summarised below instead of listing 4 empty cards each.
          if (cells.every((c) => c.kind === "undiscovered")) return null;
          return [
            <div key={`h${row}`} className="fv2ReaderRowLabel fv2Muted">{dock ? dock.name : "(beyond last dock)"}</div>,
            ...cells.map((c) => {
              const idx = (firstDock + row) * FISH_PER_ROW + c.col;
              const fish = ALL_FISH[idx];
              if (!fish) return null;
              const key = `${c.row}:${c.col}`;
              const off = c.kind === "undiscovered";
              const low = c.kind === "unreadable" || (c.kind === "count" && c.confidence < LOW_CONFIDENCE);
              return (
                <div
                  key={key}
                  className={`fv2ReaderCell${low ? " fv2ReaderCellLow" : ""}${off ? " fv2ReaderCellOff" : ""}`}
                >
                  <img className="fv2ReaderIcon" src={fishIconUrl(fish.iconFile)} alt="" loading="lazy" />
                  <span className="fv2ReaderName">{fish.name}</span>
                  {off ? (
                    <span className="fv2Chip fv2Muted">not discovered</span>
                  ) : (
                    <input
                      className="fv2ReaderInput"
                      inputMode="numeric"
                      aria-label={`${fish.name} count`}
                      value={values[key] ?? ""}
                      placeholder="?"
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value.replace(/[^\d]/g, "") }))}
                    />
                  )}
                  {low && <span className="fv2Chip fv2Warn">{c.kind === "unreadable" ? "unreadable" : "check"} ({c.raw || "-"})</span>}
                </div>
              );
            }),
          ];
        })}
      </div>

      {(() => {
        const hidden = rows
          .map((cells, row) => (cells.every((c) => c.kind === "undiscovered") ? DOCKS[firstDock + row]?.name : null))
          .filter((n): n is string => !!n);
        return hidden.length ? (
          <p className="fv2Muted">Not discovered yet, skipped: {hidden.join(", ")}.</p>
        ) : null;
      })()}

      <div className="fv2ReaderActions fv2ReaderActionsSticky">
        <button type="button" className="fv2ReaderBtn fv2ReaderBtnPrimary" onClick={apply}>Apply</button>
        <button type="button" className="fv2ReaderBtn" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}
