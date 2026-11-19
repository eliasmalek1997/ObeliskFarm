import { useEffect, useRef, useState } from "react";
import { applyStatsImport, parseStatsJson, type ImportReport } from "../lib/importStats";

/** Modal for pasting the game's stats JSON export and applying it to the module saves. */
export function ImportStats(props: { onClose: () => void; onImported: () => void }) {
  const { onClose, onImported } = props;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function doImport() {
    setError(null);
    const parsed = parseStatsJson(text);
    if (!parsed.ok) {
      setReport(null);
      setError(parsed.error);
      return;
    }
    const result = applyStatsImport(parsed.stats, parsed.version);
    if (result.modules.length === 0) {
      setReport(null);
      setError("No matching stats found in that JSON, so nothing was changed.");
      return;
    }
    setReport(result);
    // Remounts the active module so it re-reads its (now updated) save.
    onImported();
  }

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText(t);
    } catch {
      setError("Couldn't read the clipboard. Long-press the box and choose Paste instead.");
    }
  }

  return (
    <div className="importOverlay" role="dialog" aria-modal="true" aria-label="Import stats" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="importDialog">
        <div className="importHeader">
          <h2 className="importTitle">Import stats</h2>
          <button type="button" className="importClose" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {!report ? (
          <>
            <p className="importHint">
              Paste the stats JSON exported from the game. Matching values overwrite the same inputs in Stargazing, Gem EV, Bombs, Lootbug, Veins, Fishing and Drone. Everything else is left as it is.
            </p>
            <textarea
              ref={areaRef}
              className="input importTextarea mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='{"time":…,"version":"v2.2.52","stats":{…}}'
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            {error ? <p className="importError">{error}</p> : null}
            <div className="importActions">
              <button type="button" className="btn btnSecondary" onClick={pasteFromClipboard}>
                Paste from clipboard
              </button>
              <button type="button" className="btn" onClick={doImport} disabled={!text.trim()}>
                Import
              </button>
            </div>
          </>
        ) : (
          <ImportSummary report={report} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function ImportSummary(props: { report: ImportReport; onClose: () => void }) {
  const { report, onClose } = props;
  const total = report.modules.reduce((n, m) => n + m.applied.length, 0);
  return (
    <>
      <p className="importOk">
        Imported {total} values into {report.modules.length} modules{report.version ? ` (game ${report.version})` : ""}. Open a module to see them.
      </p>
      <div className="importResults">
        {report.modules.map((m) => (
          <details key={m.module} className="importModule">
            <summary>
              <strong>{m.module}</strong> <span className="small">({m.applied.length})</span>
            </summary>
            <ul className="importList mono">
              {m.applied.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        ))}
        {report.notes.length > 0 ? (
          <div className="importNotes">
            <strong>Please check</strong>
            <ul>
              {report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <details className="importModule">
          <summary>
            <strong>Not used</strong> <span className="small">({report.unusedKeys.length} fields with no matching input)</span>
          </summary>
          <p className="importList mono">{report.unusedKeys.join(", ")}</p>
        </details>
      </div>
      <div className="importActions">
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );
}
