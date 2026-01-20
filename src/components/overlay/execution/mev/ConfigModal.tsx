import { useEffect, useMemo, useRef, useState } from "react";
import {
  XMarkIcon,
  XCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export type ScenarioBlock = Record<string, string>; // variable -> "123.45%"
export type ScenarioRow = {
  period: string;
  upside: ScenarioBlock;
  base: ScenarioBlock;
  downside: ScenarioBlock;
};

type Props = {
  open: boolean;
  onClose: () => void;
  periods: string[];
  variables: string[];
  availableVariables?: string[];
  initialRows?: ScenarioRow[]; // optional prefill from GET
  onSave: (rows: ScenarioRow[], variables: string[]) => void; // rows normalized with %
};

/* ---------------- helpers: shape & normalization ---------------- */

function makeBlankBlock(vars: string[]): ScenarioBlock {
  const b: ScenarioBlock = {};
  vars.forEach((v) => (b[v] = ""));
  return b;
}

function buildTemplateRows(periods: string[], variables: string[]): ScenarioRow[] {
  return periods.map((p) => ({
    period: p,
    upside: makeBlankBlock(variables),
    base: makeBlankBlock(variables),
    downside: makeBlankBlock(variables),
  }));
}

const sanitizeFloat = (raw: string) => {
  let s = String(raw).replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  return s;
};

const normalizeFloatString = (raw: string) => {
  let s = sanitizeFloat(raw).trim();
  if (s === "." || s === "") return "";
  if (s.endsWith(".")) s = s.slice(0, -1);
  return s;
};

const stripPct = (s: string) =>
  String(s).endsWith("%") ? String(s).slice(0, -1) : String(s);
const normPct = (s: string) => {
  const v = String(s ?? "").trim();
  if (!v) return "";
  return v.endsWith("%") ? v : `${v}%`;
};
const hasValue = (s: string) => normalizeFloatString(stripPct(s)) !== "";

/** Align any incoming rows to the current periods/variables shape. */
// --- add this helper ---
function toYMD(t: string): string {
  const s = String(t);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    // MM/DD/YYYY -> YYYY-MM-DD
    const [mm, dd, yyyy] = s.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // last resort: Date parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return s;
}

// replace your alignRowsToShape with this version
function alignRowsToShape(
  incoming: ScenarioRow[] | undefined,
  periods: string[],
  variables: string[]
): ScenarioRow[] {
  if (!incoming?.length) return buildTemplateRows(periods, variables);

  // key incoming rows by canonical YYYY-MM-DD
  const incomingByKey = new Map(incoming.map((r) => [toYMD(r.period), r]));

  const fit = (blk?: ScenarioBlock) => {
    const out: ScenarioBlock = {};
    variables.forEach((v) => (out[v] = normPct(blk?.[v] ?? "")));
    return out;
  };

  // build rows in the order of periods prop, but look up using canonical key
  return periods.map((p) => {
    const hit = incomingByKey.get(toYMD(p));
    return hit
      ? {
          period: p,
          upside: fit(hit.upside),
          base: fit(hit.base),
          downside: fit(hit.downside),
        }
      : {
          period: p,
          upside: makeBlankBlock(variables),
          base: makeBlankBlock(variables),
          downside: makeBlankBlock(variables),
        };
  });
}

/* ---------------- component ---------------- */

export default function ScenarioConfigModalTable({
  open,
  onClose,
  onSave,
  periods,
  variables,
  availableVariables,
  initialRows,
}: Props) {
  const [localVariables, setLocalVariables] = useState<string[]>(variables);
  const availableList = availableVariables ?? variables;

  // Build from initialRows if provided, otherwise blank template
  const [rows, setRows] = useState<ScenarioRow[]>(
    alignRowsToShape(initialRows, periods, variables)
  );

  // Re-align when shape changes while open (periods/variables updates)
  useEffect(() => {
    if (!open) return;
    setLocalVariables(variables);
    setRows((prev) =>
      alignRowsToShape(prev?.length ? prev : initialRows, periods, variables)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, periods, variables]);

  // If modal opens (or initialRows changes) and we have prefill, apply it
  useEffect(() => {
    if (open && initialRows?.length) {
      setRows(alignRowsToShape(initialRows, periods, variables));
    }
  }, [open, initialRows, periods, variables]);

  // esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // ALL fields required
  const canSave = useMemo(
    () =>
      rows.length > 0 &&
      localVariables.length > 0 &&
      rows.every((r) =>
        (["upside", "base", "downside"] as const).every((b) =>
          localVariables.every((v) => hasValue((r as any)[b][v]))
        )
      ),
    [rows, localVariables]
  );

  /* ---------------- editing handlers ---------------- */

  /** While typing: store sanitized float (no %) */
  const setCellFloat = (
    rIdx: number,
    block: "upside" | "base" | "downside",
    variable: string,
    raw: string
  ) => {
    const cleaned = sanitizeFloat(raw);
    setRows((prev) => {
      const next = structuredClone(prev);
      (next[rIdx] as any)[block][variable] = cleaned;
      return next;
    });
  };

  /** On focus: strip one trailing % so user edits digits/decimal only */
  const stripPercentOnFocus = (
    rIdx: number,
    block: "upside" | "base" | "downside",
    variable: string
  ) => {
    setRows((prev) => {
      const next = structuredClone(prev);
      const cur = String((next[rIdx] as any)[block][variable] ?? "");
      (next[rIdx] as any)[block][variable] = cur.endsWith("%")
        ? cur.slice(0, -1)
        : cur;
      return next;
    });
  };

  /** On blur: normalize float & append % if non-empty */
  const ensurePercentOnBlur = (
    rIdx: number,
    block: "upside" | "base" | "downside",
    variable: string
  ) => {
    setRows((prev) => {
      const next = structuredClone(prev);
      const cur = String((next[rIdx] as any)[block][variable] ?? "");
      const norm = normalizeFloatString(cur);
      (next[rIdx] as any)[block][variable] = norm ? `${norm}%` : "";
      return next;
    });
  };

  /** Before saving: ensure every cell is normalized to "<float>%" */
  const normalizeAllBeforeSave = (
    grid: ScenarioRow[],
    vars: string[]
  ): ScenarioRow[] => {
    const out = structuredClone(grid) as ScenarioRow[];
    out.forEach((row) => {
      (["upside", "base", "downside"] as const).forEach((b) => {
        vars.forEach((v) => {
          const cur = String((row as any)[b][v] ?? "");
          const norm = normalizeFloatString(stripPct(cur));
          (row as any)[b][v] = norm ? `${norm}%` : "";
        });
      });
    });
    return out;
  };

  const normalizeVarName = (name: string) =>
    String(name).trim().replace(/\s+/g, " ");

  const upsertRowKey = (
    row: ScenarioRow,
    oldName: string | null,
    newName: string | null
  ): ScenarioRow => {
    const next = structuredClone(row) as ScenarioRow;
    (["upside", "base", "downside"] as const).forEach((b) => {
      const block = (next as any)[b] as ScenarioBlock;
      if (oldName && newName) {
        block[newName] = block[oldName] ?? "";
        delete block[oldName];
      } else if (newName) {
        block[newName] = block[newName] ?? "";
      } else if (oldName) {
        delete block[oldName];
      }
    });
    return next;
  };

  const addVariable = (name: string) => {
    const nextName = normalizeVarName(name);
    if (!nextName || localVariables.includes(nextName)) return;
    const nextVars = [...localVariables, nextName];
    setLocalVariables(nextVars);
    setRows((prev) => prev.map((r) => upsertRowKey(r, null, nextName)));
  };

  const deleteVariable = (name: string) => {
    const nextVars = localVariables.filter((v) => v !== name);
    setLocalVariables(nextVars);
    setRows((prev) => prev.map((r) => upsertRowKey(r, name, null)));
  };


  /* ---------------- UI ---------------- */

  const headerBase =
    "px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide";
  const cellBase =
    "px-2 py-1 text-center align-middle border-b border-gray-200";
  const inputBase =
    "w-full bg-transparent text-center outline-none rounded-md px-1";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-100/80" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-[min(1100px,95vw)] max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-200"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-semibold">
            Override Forecast Configuration
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 overflow-auto">
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="inline-flex w-fit items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 shadow-sm">
              Available variables
            </span>
            <div className="mt-3 grid max-h-40 grid-cols-1 gap-1 overflow-auto pr-1 text-xs sm:grid-cols-2">
              {availableList.map((v) => {
                const selected = localVariables.includes(v);
                return (
                  <label
                    key={v}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                      selected
                        ? "border-gray-300 bg-gray-100 text-gray-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        selected ? deleteVariable(v) : addVariable(v)
                      }
                      className="h-3.5 w-3.5 accent-gray-900"
                    />
                    <span className="truncate">{v}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-[960px] w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left w-40 bg-[#F8F8F8]">
                    Period
                  </th>
                  <th
                    colSpan={Math.max(localVariables.length, 1)}
                    className={`${headerBase} bg-emerald-50`}
                  >
                    Upside
                  </th>
                  <th
                    colSpan={Math.max(localVariables.length, 1)}
                    className={`${headerBase} bg-amber-50`}
                  >
                    Base
                  </th>
                  <th
                    colSpan={Math.max(localVariables.length, 1)}
                    className={`${headerBase} bg-rose-50`}
                  >
                    Downside
                  </th>
                </tr>
                <tr>
                  <th className="px-3 py-1 text-left text-xs bg-[#F8F8F8]">
                    {" "}
                  </th>
                  {["bg-emerald-50", "bg-amber-50", "bg-rose-50"].flatMap(
                    (bg, i) =>
                      localVariables.length
                        ? localVariables.map((v) => (
                            <th
                              key={`${i}-${v}`}
                              className={`px-3 py-1 text-center text-xs ${bg}`}
                            >
                              {v}
                            </th>
                          ))
                        : [
                            <th
                              key={`${i}-placeholder`}
                              className={`px-3 py-1 text-center text-xs ${bg}`}
                            >
                              â€”
                            </th>,
                          ]
                  )}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.period}
                    className={i % 2 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className={`${cellBase} text-left font-medium`}>
                      {r.period}
                    </td>

                    {/* Upside */}
                    {localVariables.map((v) => {
                      const val = r.upside[v] ?? "";
                      const invalid = !hasValue(val);
                      return (
                        <td
                          key={`upside-${v}-${i}`}
                          className={`${cellBase} bg-emerald-50`}
                        >
                          <input
                            required
                            inputMode="decimal"
                            pattern="^[0-9]*\.?[0-9]*$"
                            placeholder="e.g. 5.6%"
                            value={val}
                            onFocus={() => stripPercentOnFocus(i, "upside", v)}
                            onChange={(e) =>
                              setCellFloat(i, "upside", v, e.target.value)
                            }
                            onBlur={() => ensurePercentOnBlur(i, "upside", v)}
                            className={`${inputBase} ${
                              invalid
                                ? "ring-1 ring-red-300 focus:ring-red-400"
                                : "focus:ring-emerald-300"
                            }`}
                          />
                        </td>
                      );
                    })}

                    {/* Base */}
                    {localVariables.map((v) => {
                      const val = r.base[v] ?? "";
                      const invalid = !hasValue(val);
                      return (
                        <td
                          key={`base-${v}-${i}`}
                          className={`${cellBase} bg-amber-50`}
                        >
                          <input
                            required
                            inputMode="decimal"
                            pattern="^[0-9]*\.?[0-9]*$"
                            placeholder="e.g. 5.6%"
                            value={val}
                            onFocus={() => stripPercentOnFocus(i, "base", v)}
                            onChange={(e) =>
                              setCellFloat(i, "base", v, e.target.value)
                            }
                            onBlur={() => ensurePercentOnBlur(i, "base", v)}
                            className={`${inputBase} ${
                              invalid
                                ? "ring-1 ring-red-300 focus:ring-red-400"
                                : "focus:ring-amber-300"
                            }`}
                          />
                        </td>
                      );
                    })}

                    {/* Downside */}
                    {localVariables.map((v) => {
                      const val = r.downside[v] ?? "";
                      const invalid = !hasValue(val);
                      return (
                        <td
                          key={`downside-${v}-${i}`}
                          className={`${cellBase} bg-rose-50`}
                        >
                          <input
                            required
                            inputMode="decimal"
                            pattern="^[0-9]*\.?[0-9]*$"
                            placeholder="e.g. 5.6%"
                            value={val}
                            onFocus={() => stripPercentOnFocus(i, "downside", v)}
                            onChange={(e) =>
                              setCellFloat(i, "downside", v, e.target.value)
                            }
                            onBlur={() => ensurePercentOnBlur(i, "downside", v)}
                            className={`${inputBase} ${
                              invalid
                                ? "ring-1 ring-red-300 focus:ring-red-400"
                                : "focus:ring-rose-300"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-white">
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-1.5"
          >
            <XCircleIcon className="h-4 w-4" />
            <span>Cancel</span>
          </button>
          <button
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave(normalizeAllBeforeSave(rows, localVariables), localVariables);
            }}
            className="rounded-xl bg-gray-100 text-gray-900 px-4 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckCircleIcon className="h-4 w-4" />
            <span>Save configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
}

