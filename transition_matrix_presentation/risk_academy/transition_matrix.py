"""
transition_matrix.py — the Transition Matrix (PD) process, as pandas functions.

A self-contained, **pandas-only** packaging of the same steps the teaching notebook
builds by hand — no numpy, no matplotlib. Reuse it in your own work:

    import transition_matrix as tm

    panel   = tm.load_panel()                  # 60 monthly files -> one long table
    buckets = tm.apply_everbad(tm.bucketize_frame(tm.to_wide(panel)))
    avg     = tm.average_matrix(buckets)        # through-the-cycle 5x5 matrix
    twelve  = tm.project(avg, 12)               # 12-month matrix
    print(tm.ttc_pd(avg))                       # 12-month PD per aging bucket

The steps: consolidate -> pivot -> bucket -> everbad -> default rate -> build the
matrix -> Markov (project) -> TTC PD -> compare.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

# --------------------------------------------------------------------------
# The five aging buckets. "91+ DPD" (bucket 4) is default / "Bad"; 0-3 are "Good".
# --------------------------------------------------------------------------
LABELS = ["0 DPD", "1-30 DPD", "31-60 DPD", "61-90 DPD", "91+ DPD"]
DEFAULT_LABEL = "91+ DPD"            # the default column
N_BUCKETS = 5

REQUIRED_COLUMNS = ["pn_number", "loan_segment", "report_date", "dpd"]


# --------------------------------------------------------------------------
# Step 0 — find the data
# --------------------------------------------------------------------------
def find_data_root() -> Path:
    """Locate the 'Transactional Data' folder (next to this file, or one level up).

    If neither exists, generates a synthetic copy with generate_sample_data.py.
    """
    here = Path(__file__).resolve().parent
    for candidate in (here / "data" / "Transactional Data",
                      here.parent / "data" / "Transactional Data"):
        if candidate.exists():
            return candidate

    gen = here / "generate_sample_data.py"
    if gen.exists():
        import runpy
        runpy.run_path(str(gen), run_name="__main__")
        made = here / "data" / "Transactional Data"
        if made.exists():
            return made

    raise FileNotFoundError(
        "Could not find 'data/Transactional Data'. Run generate_sample_data.py "
        "first, or point find_data_root() at the real archive folder."
    )


# --------------------------------------------------------------------------
# 1 — Consolidate.  Read every monthly file and stack into one long table.
# --------------------------------------------------------------------------
def load_panel(data_root: Path | str | None = None) -> pd.DataFrame:
    """Read every monthly extract and consolidate into one long table."""
    root = Path(data_root) if data_root is not None else find_data_root()
    files = sorted(root.glob("*/Transactional Report *.xlsx"))
    if not files:
        raise FileNotFoundError(f"No extract files under {root}")

    frames = [pd.read_excel(f) for f in files]     # read many...
    panel = pd.concat(frames, ignore_index=True)   # ...concat once

    panel["report_date"] = pd.to_datetime(panel["report_date"])
    panel["dpd"] = pd.to_numeric(panel["dpd"], errors="coerce")
    return panel


# --------------------------------------------------------------------------
# Data validation — the same core checks a good pipeline runs before using data.
# --------------------------------------------------------------------------
def validate_transactional_data(df: pd.DataFrame) -> dict:
    """Validate consolidated transactional data. Returns {status, issues}.

    Checks: required columns present, no duplicate columns, report_date parses as a
    date and dpd as a number, and no column more than 10% missing.
    """
    issues: list[str] = []
    cols = {str(c).strip().lower(): c for c in df.columns}

    missing_cols = [c for c in REQUIRED_COLUMNS if c not in cols]
    if missing_cols:
        issues.append(f"Missing required columns: {missing_cols}")

    dupes = df.columns[df.columns.duplicated()].tolist()
    if dupes:
        issues.append(f"Duplicate columns: {dupes}")

    if "report_date" in cols:
        parsed = pd.to_datetime(df[cols["report_date"]], errors="coerce")
        bad = int((parsed.isna() & df[cols["report_date"]].notna()).sum())
        if bad:
            issues.append(f"report_date: {bad} values are not valid dates")
    if "dpd" in cols:
        num = pd.to_numeric(df[cols["dpd"]], errors="coerce")
        bad = int((num.isna() & df[cols["dpd"]].notna()).sum())
        if bad:
            issues.append(f"dpd: {bad} values are not numeric")

    n = len(df)
    for c in df.columns:
        miss = int(df[c].isna().sum())
        if n and miss and miss / n > 0.10:
            issues.append(f"{c}: {miss} missing ({miss / n:.1%}) — over 10%")

    return {"status": "passed" if not issues else "failed", "issues": issues}


# --------------------------------------------------------------------------
# 2 — Pivot.  One row per loan (pn_number), one column per report month.
# --------------------------------------------------------------------------
def to_wide(panel: pd.DataFrame) -> pd.DataFrame:
    """One row per loan, one column per report month, DPD in the cells."""
    wide = panel.pivot_table(
        index="pn_number",
        columns="report_date",
        values="dpd",
        aggfunc="first",
    )
    wide.columns = [c.strftime("%Y-%m-%d") for c in wide.columns]
    return wide[sorted(wide.columns)]


def month_columns(wide: pd.DataFrame) -> list[str]:
    """The report-month column labels, in order."""
    return sorted(wide.columns)


# --------------------------------------------------------------------------
# 3 — Bucket.  Map each DPD to its aging bucket (0-4). Missing stays missing.
# --------------------------------------------------------------------------
def bucketize(v) -> float:
    """DPD -> aging bucket for a single value."""
    if pd.isna(v):
        return float("nan")
    if v == 0:
        return 0
    if v <= 30:
        return 1
    if v <= 60:
        return 2
    if v <= 90:
        return 3
    return 4


def bucketize_frame(wide: pd.DataFrame) -> pd.DataFrame:
    """Bucket every cell of the grid (vectorised with pd.cut)."""
    months = month_columns(wide)
    bins = [-1, 0, 30, 60, 90, float("inf")]
    out = wide.copy()
    for m in months:
        out[m] = pd.cut(wide[m], bins=bins, labels=[0, 1, 2, 3, 4]).astype("float")
    return out


# --------------------------------------------------------------------------
# 4 — Everbad.  Once an account is Bad (bucket 4) it stays Bad.
# --------------------------------------------------------------------------
def apply_everbad(buckets: pd.DataFrame) -> pd.DataFrame:
    """Make default absorbing: once a loan hits bucket 4, force it to 4 thereafter."""
    months = month_columns(buckets)
    out = buckets.copy()
    for idx in out.index:
        seen_default = False
        for m in months:
            v = out.at[idx, m]
            if pd.isna(v):
                continue                  # not on the book — skip, don't reset
            if seen_default:
                out.at[idx, m] = 4
            elif v == 4:
                seen_default = True
    return out


# --------------------------------------------------------------------------
# 5 — Observed default rate (ODR).  Good at a point that turned Bad 12 months on.
# --------------------------------------------------------------------------
def observed_default_rate(buckets: pd.DataFrame, window: int = 12) -> pd.DataFrame:
    """Observed Default Rate (ODR) per observation month."""
    months = month_columns(buckets)
    rows = []
    for i in range(len(months) - window):
        obs, end = months[i], months[i + window]
        good = buckets[obs].isin([0, 1, 2, 3])
        turned_bad = good & (buckets[end] == 4)
        if good.sum():
            rows.append({"observation": obs, "window_end": end,
                         "n_good": int(good.sum()),
                         "turned_bad": int(turned_bad.sum()),
                         "odr": turned_bad.sum() / good.sum()})
    out = pd.DataFrame(rows)
    out["observation"] = pd.to_datetime(out["observation"])
    out["window_end"] = pd.to_datetime(out["window_end"])
    return out


# Back-compat alias.
backtest = observed_default_rate


# --------------------------------------------------------------------------
# 6 — Build the matrix.  Count -> Percentage -> Average.
# --------------------------------------------------------------------------
def count_matrix_for_pair(buckets: pd.DataFrame, m_from: str, m_to: str) -> pd.DataFrame:
    """Migration COUNTS for one month-pair: 5 source buckets, plus Indeterminate.

    Columns 0-4 are destination buckets; 'Indeterminate' is loans on the book at
    m_from but gone at m_to. 'Total Accounts Evaluated' is the row total of 0-4.
    """
    rows = []
    for a in range(N_BUCKETS):
        src = buckets[m_from] == a
        row = {b: int((src & (buckets[m_to] == b)).sum()) for b in range(N_BUCKETS)}
        row["Indeterminate"] = int((src & buckets[m_to].isna()).sum())
        rows.append(row)
    counts = pd.DataFrame(rows, index=LABELS)
    counts["Total Accounts Evaluated"] = counts[list(range(N_BUCKETS))].sum(axis=1)
    return counts


def matrix_for_pair(buckets: pd.DataFrame, m_from: str, m_to: str) -> pd.DataFrame:
    """Migration PERCENTAGES for one month-pair (5x5), each row summing to 1.

    Each cell = count / Total Accounts Evaluated (Indeterminate excluded).
    """
    counts = count_matrix_for_pair(buckets, m_from, m_to)
    total = counts["Total Accounts Evaluated"]
    pct = counts[list(range(N_BUCKETS))].div(total, axis=0)
    pct.columns = LABELS
    return pct


def average_matrix(buckets: pd.DataFrame) -> pd.DataFrame:
    """The average (through-the-cycle) 5x5 matrix over every adjacent month-pair."""
    months = month_columns(buckets)
    mats = [matrix_for_pair(buckets, months[i], months[i + 1])
            for i in range(len(months) - 1)]
    avg = pd.concat(mats).groupby(level=0).mean()   # mean skips empty periods
    return avg.reindex(index=LABELS, columns=LABELS)


# --------------------------------------------------------------------------
# 7 — Markov.  Multiply the average matrix by itself n times (.dot in a loop).
# --------------------------------------------------------------------------
def project(matrix: pd.DataFrame, n_months: int = 12) -> pd.DataFrame:
    """n-month transition probabilities = matrix multiplied by itself n times."""
    result = matrix.copy()
    for _ in range(n_months - 1):
        result = result.dot(matrix)
    return result


# --------------------------------------------------------------------------
# 8 — TTC PD.  The default column of the 12-step matrix.
# --------------------------------------------------------------------------
def ttc_pd(matrix: pd.DataFrame, horizon: int = 12) -> pd.Series:
    """12-month through-the-cycle PD for each starting aging bucket."""
    projected = project(matrix, horizon)
    return projected[DEFAULT_LABEL].rename(f"{horizon}m TTC PD")


def pd_term_structure(matrix: pd.DataFrame, horizon: int = 12) -> pd.DataFrame:
    """PD for each starting bucket at 1..horizon months ahead (the PD build-up)."""
    rows, power = {}, matrix.copy()
    for n in range(1, horizon + 1):
        rows[n] = power[DEFAULT_LABEL]
        power = power.dot(matrix)
    out = pd.DataFrame(rows).T
    out.index.name = "months ahead"
    return out


# --------------------------------------------------------------------------
# The whole pipeline in one call.
# --------------------------------------------------------------------------
def run_pipeline(data_root: Path | str | None = None, horizon: int = 12):
    """Return (avg_matrix, projected_matrix, ttc_pd_series) end to end."""
    panel = load_panel(data_root)
    buckets = apply_everbad(bucketize_frame(to_wide(panel)))
    avg = average_matrix(buckets)
    projected = project(avg, horizon)
    return avg, projected, ttc_pd(avg, horizon)


if __name__ == "__main__":
    avg, proj, pd12 = run_pipeline()
    print("Average transition matrix (one-month):")
    print(avg.round(4))
    print("\n12-month TTC PD by aging bucket:")
    print(pd12.map(lambda x: f"{x:.2%}"))
