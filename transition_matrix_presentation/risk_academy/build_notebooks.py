#!/usr/bin/env python3
"""
build_notebooks.py — emit both risk-academy notebooks from one source.

    python build_notebooks.py

A self-contained, step-by-step walkthrough of the Transition Matrix process in
Python (consolidate → pivot → bucket → everbad → default rate → matrix → Markov →
TTC PD → compare), written for a room that just learned Python and pandas basics.

Produces, side by side and always consistent:

  * Transition_Matrix_RISK_LIVE.ipynb   -> hand this to the risk audience.
  * Transition_Matrix_FACILITATOR.ipynb -> teach from this (superset: adds the
        grey SAY / DO / Q&A talk-track boxes, timing and expected outputs).

Edit content HERE, then rerun. Never hand-edit the .ipynb files.
"""

from __future__ import annotations

import json
from pathlib import Path

FAC: list[dict] = []
RISK: list[dict] = []
_ID = [0]


def _next_id() -> str:
    _ID[0] += 1
    return f"cell-{_ID[0]:03d}"


def _md(text: str) -> dict:
    return {"cell_type": "markdown", "id": _next_id(), "metadata": {},
            "source": text.strip("\n").splitlines(keepends=True)}


def _code(text: str) -> dict:
    return {"cell_type": "code", "id": _next_id(), "metadata": {},
            "execution_count": None, "outputs": [],
            "source": text.strip("\n").splitlines(keepends=True)}


def md(text, who="both"):
    if who in ("both", "fac"):
        FAC.append(_md(text))
    if who in ("both", "risk"):
        RISK.append(_md(text))


def code(text, who="both"):
    if who in ("both", "fac"):
        FAC.append(_code(text))
    if who in ("both", "risk"):
        RISK.append(_code(text))


def talk(text):
    """A facilitator-only talk-track box."""
    FAC.append(_md(text))


# ==========================================================================
# TITLE  (workbook sheet 0.0 — Process Flow Chart)
# ==========================================================================
md(r"""
# Building the Transition Matrix in Python

### FSRM Academy · Coding Series · Transition Matrix

---

This is a walkthrough of the **Transition Matrix** in Python — the same process
you know from the working paper, built step by step from the raw transactional
data. Follow along and run each cell yourself.

This session covers the **Transition Matrix only**. The parts that follow it —
net flow rate, ECL, and so on — are separate sessions.

> **Where we're headed:** for a loan in each aging bucket today, its probability of
> default within 12 months — the *Through-the-Cycle PD*.
""")

md(r"""
### The steps

```
   Raw transactional data (5 years of monthly extracts)
       │
       ▼
   1. Consolidate        stack every monthly file into one dataset
   2. Pivot              one row per loan, report months across, DPD in cells
   3. Bucket             DPD  ->  aging bucket 0–4
   4. Everbad            once Bad (4), always Bad
   5. Default rate (ODR) good → bad over a 12-month window
   6. Build the matrix   Count  ->  Percentage  ->  Average
   7. Markov             multiply the average matrix by itself 12 times
       │
       ├──►  8. TTC PD               last column of the 12-step matrix  ← the output
       └──►  9. Compare vs actual    model number vs the observed rate
```

Everything today is done with **pandas** — no other library. We assume the pandas
basics (DataFrames, filtering, `groupby`) are already covered, and each new bit of
code gets a quick explanation the first time it shows up.

**One rule for today:** after every cell, look at the **shape** of what came back.
`df.shape` is the fastest way to catch a mistake.
""")

talk(r"""
> **▶ FACILITATOR — quick reminders** (full talk track: `FACILITATOR_SCRIPT.md`)
>
> - You're on the **tech side** — teach the **code**, hand risk questions back to
>   the room. This session is the **Transition Matrix** only (net flow rate, ECL are
>   colleagues' sessions).
> - The rhythm is: **say what we're about to do → run the cell → show the result.**
> - **Say the shape** after each cell — that's what keeps people with you.
> - **Numbers:** sample data, so the PD is ~**7.6%**, not the ~**11.64%** on the
>   real portfolio. Say so up front.
> - **Timing:** ~65–70 min. The consolidation read cell is the slow one (~40s) —
>   start it, talk over it. Before you start: Kernel → Restart, run Setup.
> - The grey boxes are only in this copy (the audience's is clean).
""")

# ==========================================================================
# SETUP
# ==========================================================================
md(r"""
---
## Setup

Two small steps: bring in the library, then tell Python where the data is.
""")

md(r"""
**Step 1 — bring in the library we'll use.** Everything today is **pandas** — the
one you learned this morning. It handles the data, the maths, the tables, and even
the charts. (`Path` is from Python itself, just to find the files.)
""")

code(r"""
import pandas as pd
from pathlib import Path
""")

md("**Step 2 — point Python at the data folder.**")

code(r"""
# transition_matrix.py sits next to this notebook. We borrow one helper from it
# that finds the data folder (and builds a sample set the first time, if needed).
import transition_matrix as tm

DATA_ROOT = tm.find_data_root()
print("Data folder:", DATA_ROOT)
""")

# ==========================================================================
# 1.x — INPUT DATA
# ==========================================================================
md(r"""
---
## The input data

Our starting point is **5 years of monthly transactional extracts** — one file per
month, 60 in all, each a month-end snapshot of the loan book. We assume they're
already cleaned and consistently named (same columns each month, correct data
types).

Only four columns do the real work downstream: **`pn_number`**, **`loan_segment`**,
**`report_date`**, **`dpd`**. Let's open one file and look at it.
""")

code(r"""
# Peek at one raw monthly extract — this is what a single snapshot looks like.
one_file = sorted(DATA_ROOT.glob("*/Transactional Report *.xlsx"))[0]
sample = pd.read_excel(one_file)
print(one_file.name, "->", sample.shape)
sample.head()
""")

# ==========================================================================
# 2.1 — DATA CONSOLIDATION
# ==========================================================================
md(r"""
---
## 1 · Consolidate the monthly files

First we bring all 60 monthly files together into one dataset. Three lines: read
each Excel file into a **DataFrame** (the table you met in the pandas session),
collect them in a list, and stack the whole list into one table with `concat`.

> 💡 One habit: read every file into the list first, then `concat` once at the end.
> Stacking *inside* the loop recopies the whole table each pass and gets slow.
""")

md("**Step 1 — list the input files.**")

code(r"""
files = sorted(DATA_ROOT.glob("*/Transactional Report *.xlsx"))
print(f"Found {len(files)} monthly files")
""")

md(r"""
**Step 2 — read each file into a DataFrame.** This is the slow step (~40s), so we
loop over the files and **print progress** as we go, so you can see it's working.
""")

code(r"""
frames = []                                  # we'll collect the 60 tables here
for i, f in enumerate(files, start=1):
    frames.append(pd.read_excel(f))          # read one file into a DataFrame
    if i % 10 == 0 or i == len(files):       # tick every 10 files
        print(f"  read {i} / {len(files)} files…")

print("One file :", frames[0].shape)         # (rows, columns)
""")

md("**Step 3 — stack them all into one table** with `concat`.")

code(r"""
panel = pd.concat(frames, ignore_index=True)
print("Consolidated:", panel.shape, " <- about 60x the rows")
panel.head()
""")

talk(r"""
> **▶ DO:** Step 2 (the read) takes ~40s — start it, then keep talking. When it's
> done: "one file's about a thousand rows; stacked, about sixty thousand — 60 times
> a thousand, so nothing dropped."
>
> **▶ SAY:** "`ignore_index=True` just renumbers the rows cleanly."
""")

# ==========================================================================
# DATA VALIDATION  (what the ECL app does at upload)
# ==========================================================================
md(r"""
---
## Data validation

We're *assuming* the data is clean — but before we build anything on it, it's good
practice to actually check. (This is the same kind of check the ECL app runs on any
file before it uses it.) Four quick checks on our consolidated data:

- the **required columns** are all present
- there are **no duplicate columns**
- **`report_date`** really reads as a date, and **`dpd`** as a number
- no column is **more than 10% missing**
""")

md("**Step 1 — write the checks.**")

code(r"""
REQUIRED = ["pn_number", "loan_segment", "report_date", "dpd"]

def validate_transactional_data(df):
    issues = []
    cols = {str(c).strip().lower(): c for c in df.columns}   # case-insensitive lookup

    # 1) required columns present
    missing_cols = [c for c in REQUIRED if c not in cols]
    if missing_cols:
        issues.append(f"Missing required columns: {missing_cols}")

    # 2) no duplicate columns
    dupes = df.columns[df.columns.duplicated()].tolist()
    if dupes:
        issues.append(f"Duplicate columns: {dupes}")

    # 3) report_date is a real date, dpd is a real number
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

    # 4) missing values per column — flag anything over 10% (a common threshold)
    n = len(df)
    for c in df.columns:
        miss = int(df[c].isna().sum())
        if miss and miss / n > 0.10:
            issues.append(f"{c}: {miss} missing ({miss/n:.1%}) — over 10%")

    return {"status": "passed" if not issues else "failed", "issues": issues}
""")

md("**Step 2 — run the checks on our consolidated data.**")

code(r"""
result = validate_transactional_data(panel)

print("Validation:", result["status"].upper())
for msg in result["issues"]:
    print("  -", msg)
if result["status"] == "passed":
    print("  Required columns present, no duplicates, report_date & dpd the right")
    print("  type, nothing over 10% missing — safe to build on.")
""")

md(r"""
**Step 3 — it passed, so set the two key columns to their working types** and we're
ready to reshape.
""")

code(r"""
panel["report_date"] = pd.to_datetime(panel["report_date"])
panel["dpd"] = pd.to_numeric(panel["dpd"], errors="coerce")

print("Distinct loans      :", f"{panel['pn_number'].nunique():,}")
print("Distinct month-ends :", panel["report_date"].nunique())
""")

talk(r"""
> **▶ SAY:** "We're assuming the data's clean, but it's worth actually checking
> before we build on it. Same checks either way: right columns, no duplicates, dates
> and DPD the right type, nothing over 10% blank. Ours passes."
>
> **▶ If asked:** on a failure it lists the problems, and you'd fix the data before
> going on — same messages this would print.
""")

# ==========================================================================
# PIVOTING
# ==========================================================================
md(r"""
---
## 2 · Pivot to a loan × month grid

Right now the data is **long** — one row per loan *per month*. To see a loan
*move*, we reshape it **wide**: one row per loan, one column per month, DPD in the
cells. pandas does this in one call, `pivot_table`, which asks four things: what's
each **row** (`index`), each **column** (`columns`), what fills the **cells**
(`values`), and what to do with duplicates (`aggfunc`).

Why bother? Because once it's a grid, a loan's **movement** is just two cells side
by side in the same row — which is the whole thing we're about to count.
""")

md("**Step 1 — pivot the long table into the wide grid.**")

code(r"""
wide = panel.pivot_table(
    index="pn_number",       # unique PN numbers -> rows
    columns="report_date",   # report months     -> columns
    values="dpd",            # DPD               -> cells
    aggfunc="first",
)
print("Long :", panel.shape)
print("Wide :", wide.shape, " <- one row per loan now")
wide.iloc[:6, :6]
""")

md("**Step 2 — tidy the month labels and put them in order.**")

code(r"""
wide.columns = [c.strftime("%Y-%m-%d") for c in wide.columns]
months = sorted(wide.columns)
wide = wide[months]
wide.iloc[:6, :6]
""")

md(r"""
The blanks (`NaN`) are **meaningful**: the account wasn't on the book that month —
not yet drawn, or already closed. Later, when we count movements, these become the
**Indeterminate** group.
""")

code(r"""
filled = wide.notna().sum().sum()
total = wide.shape[0] * wide.shape[1]
print(f"Grid          : {wide.shape[0]:,} loans x {wide.shape[1]} months")
print(f"On book (filled): {filled:,} ({filled/total:.0%})")
print(f"Not on book (NA): {total-filled:,} ({1-filled/total:.0%})")
""")

# ==========================================================================
# 2.3 — BUCKETING
# ==========================================================================
md(r"""
---
## 3 · Bucket the DPD

Next we turn the raw day count into an **aging bucket**, 0 to 4, using the standard
bands:

| DPD | Bucket |
|---|---|
| 0 | 0 |
| 1 – 30 | 1 |
| 31 – 60 | 2 |
| 61 – 90 | 3 |
| 91+ | 4 · **default** |

*(The bands can vary by institution policy — set them to yours.)* We write the rule
once as a small **function** and let pandas apply it to every cell.
""")

md(r"""
**Write the rule as a function.** A couple of things to note as we read it:

- `pd.isna(v)` tests for a blank. Missing must **stay** missing — it returns
  `float("nan")`, *not* 0. (Not-on-book is not the same as paying perfectly.)
- The **order** of the `if`s matters — each one only sees what got past the ones
  above it.
""")

code(r"""
def bucket(v):
    if pd.isna(v):
        return float("nan")     # missing stays missing
    if v == 0:
        return 0
    if v <= 30:
        return 1
    if v <= 60:
        return 2
    if v <= 90:
        return 3
    return 4

# Test — all five should print True
print(bucket(0) == 0, bucket(15) == 1, bucket(45) == 2,
      bucket(75) == 3, bucket(120) == 4)
""")

talk(r"""
> **▶ SAY:** "Order matters because each check only sees what got past the one
> above it. Put the 90 check first and everything lands in the wrong bucket — and it
> won't error, it'll just be wrong, which is worse."
""")

code(r"""
# Apply the rule to every cell of the grid. (.apply runs the function per value.)
buckets_raw = wide.copy()
for m in months:
    buckets_raw[m] = buckets_raw[m].apply(bucket)

buckets_raw.iloc[:6, :6]
""")

# ==========================================================================
# 2.4 — EVERBAD
# ==========================================================================
md(r"""
---
## 4 · Apply the everbad rule

Good = buckets **0–3**, Bad = bucket **4**. In the raw data, loans **recover** from
default. The everbad rule ignores those recoveries: once an account has ever hit
bucket 4, it stays 4 for the rest of its life. Default becomes a one-way door.

We do it with one small **loop** that walks along each account's row, left to right,
remembering "have we seen a default yet?" and setting everything after the first 4
to 4.
""")

code(r"""
buckets = buckets_raw.copy()

for idx in buckets.index:                 # each account
    seen_default = False
    for m in months:                      # each month, left to right
        v = buckets.at[idx, m]
        if pd.isna(v):
            continue                      # not on the book — skip, don't reset
        if seen_default:
            buckets.at[idx, m] = 4        # force it Bad
        elif v == 4:
            seen_default = True           # from here on, always Bad

print("Everbad applied.")
""")

md(r"""
A loop is the right tool here: each cell depends on the cells before it, and we
carry a memory (`seen_default`) along the row. How much did the rule change?
""")

code(r"""
raw = buckets_raw[months]
fixed = buckets[months]

on_book = raw.notna()                                   # cells that had a value
changed = int((on_book & (raw != fixed)).sum().sum())   # how many we rewrote

was_bad = (raw == 4)                                    # True where raw = default
ever_bad = int(was_bad.any(axis=1).sum())               # accounts ever bad
# .cummax across the row is True from the first default onward:
after_first_bad = was_bad.cummax(axis=1)
recovered = (after_first_bad & on_book & (raw != 4)).any(axis=1)
cured = int(recovered.sum())

print(f"Accounts that ever defaulted : {ever_bad:,}")
print(f"  …that later recovered      : {cured:,}")
print(f"Cells rewritten to Bad       : {changed:,}  ({changed/int(on_book.sum().sum()):.1%} of all data)")
""")

talk(r"""
> **▶ SAY:** "It walks left to right; the moment it hits a 4, it sets everything
> after to 4. The impact cell just shows how many that changed."
> **▶ If asked why:** hand it to the room — "you'll know the reasoning better than
> me."
""")

# ==========================================================================
# 2.5 — DEFAULT RATE (ODR)
# ==========================================================================
md(r"""
---
## 5 · Observed default rate (ODR)

The **observed** default rate — measured straight from the data, no matrix. Of the
Good accounts at a point in time, how many turned Bad over the next 12 months,
divided by the total Good at the start. We use it twice: as a reality check on the
model later, and as the historical series at the end.

The trick in Python is a **boolean mask**: comparing a whole column (like
`buckets == 4`) gives a True/False for every row. `"Good at the start"` and
`"Bad 12 months later"` are two of those; combine them, count, divide.
""")

md(r"""
**Let's do one first**, by hand — observation month **Jan 2021**, a 12-month window
ending **Jan 2022**. Good at the start (`.isin([0,1,2,3])`), of those how many are
Bad twelve months later, then divide.
""")

code(r"""
obs = "2021-01-31"
end = "2022-01-31"

good = buckets[obs].isin([0, 1, 2, 3])       # Good at the observation point
turned_bad = good & (buckets[end] == 4)       # Bad 12 months later

print(f"1. Good in {obs}          : {good.sum():,}")
print(f"2. …that turned Bad by {end} : {turned_bad.sum():,}")
print(f"3. ODR                        : {turned_bad.sum()/good.sum():.2%}")
""")

md(r"""
Now every observation month, rolled into the full ODR series — we chart this at the
very end to compare against the model.
""")

code(r"""
rows = []
for i in range(len(months) - 12):
    o, e = months[i], months[i + 12]
    good = buckets[o].isin([0, 1, 2, 3])
    turned_bad = good & (buckets[e] == 4)
    if good.sum():
        rows.append({"observation": o, "window_end": e,
                     "n_good": int(good.sum()),
                     "turned_bad": int(turned_bad.sum()),
                     "odr": turned_bad.sum() / good.sum()})

odr = pd.DataFrame(rows)
odr["window_end"] = pd.to_datetime(odr["window_end"])
print(f"Observation cohorts : {len(odr)}")
print(f"Average ODR         : {odr['odr'].mean():.2%}")
print(f"Range               : {odr['odr'].min():.2%} to {odr['odr'].max():.2%}")
odr.head()
""")

talk(r"""
> **▶ SAY:** "The one thing to watch is the bottom of the fraction — it's the good
> ones at the *start*. On the real book the early-2020 cohorts run above 50% — the
> pandemic. Here it's gentler, same shape. Hold this series — we use it again at the
> end to compare against the model."
""")

# ==========================================================================
# 2.6 — MATRIX CONSTRUCTION
# ==========================================================================
md(r"""
---
## 6 · Build the transition matrix

This is the core, in three moves: **Count → Percentage → Average.**

- **Count** — for one pair of months, how many accounts moved from each bucket to
  each bucket.
- **Percentage** — divide each count by its row total, so each row becomes the
  probabilities of where an account in that bucket goes next.
- **Average** — do that for every pair of adjacent months and average them, giving
  the typical, through-the-cycle behaviour.

We start with the **Count** for one month-pair — including an **Indeterminate**
column (accounts that left the book) and **Total Accounts Evaluated** (the row total
that excludes Indeterminate).
""")

code(r"""
jan, feb = "2021-01-31", "2021-02-28"
LABELS = ["0 DPD", "1-30 DPD", "31-60 DPD", "61-90 DPD", "91+ DPD"]

def count_matrix(m_from, m_to):
    # For each starting bucket, count where those accounts ended up.
    rows = []
    for a in range(5):
        src = buckets[m_from] == a                      # accounts starting in bucket a
        row = {b: int((src & (buckets[m_to] == b)).sum()) for b in range(5)}
        row["Indeterminate"] = int((src & buckets[m_to].isna()).sum())  # left the book
        rows.append(row)
    counts = pd.DataFrame(rows, index=LABELS)
    counts["Total Accounts Evaluated"] = counts[[0, 1, 2, 3, 4]].sum(axis=1)
    return counts

count_matrix(jan, feb)
""")

md(r"""
**Percentage** = each count ÷ Total Accounts Evaluated for its row (Indeterminate
is left out of the denominator — e.g. `824 / 838 = 98.33%`). `.div(total, axis=0)`
divides each row by its own total. Each row now sums to 100%, our quick check.
""")

code(r"""
def transition_matrix(m_from, m_to):
    counts = count_matrix(m_from, m_to)
    total = counts["Total Accounts Evaluated"]
    return counts[[0, 1, 2, 3, 4]].div(total, axis=0)   # each row / its total

one = transition_matrix(jan, feb)
print("Row sums:", one.sum(axis=1).round(4).tolist(), " <- each row = 100%")
one.style.format("{:.1%}")
""")

md(r"""
**Average** across every adjacent month-pair → the through-the-cycle matrix. We
build one grid per pair, `concat` them into a tall stack, and `groupby` the row
label and take the `mean` — which skips any period where a bucket was empty.
""")

code(r"""
all_matrices = [transition_matrix(months[i], months[i + 1])
                for i in range(len(months) - 1)]

# Stack them, then average each row-label across all the periods.
avg = pd.concat(all_matrices).groupby(level=0).mean()
avg = avg.reindex(LABELS)                 # keep buckets in order
avg.columns = LABELS                      # label the destination columns too

print("Number of monthly grids :", len(all_matrices))
print("Row sums:", avg.sum(axis=1).round(4).tolist())

avg.index.name = "from \\ to"
avg.style.format("{:.1%}")
""")

talk(r"""
> **▶ SAY:** "Three moves — count, percentages, average. On the percentage grid,
> point out every row adds to 100% (the quick check). The average `concat` +
> `groupby().mean()` does all the monthly grids at once."
> **▶ Take this one slow** — it's the core of the session.
""")

# ==========================================================================
# 2.7 — MARKOV
# ==========================================================================
md(r"""
---
## 7 · Project forward (Markov)

The matrix so far covers **one month**. We need **twelve** — so we multiply the
average matrix by itself 12 times. pandas multiplies two matrices with `.dot()`, so
we just `.dot()` in a short loop.

Why multiply at all? To go from bucket 0 to bucket 4 in two months, an account
could pass through any bucket in month one — and multiplying the matrices adds up
every one of those paths for you automatically.
""")

code(r"""
# Multiplying two matrices in pandas is .dot(). To multiply by itself 12 times,
# we just .dot() in a loop.
def project(matrix, n):
    result = matrix.copy()
    for _ in range(n - 1):
        result = result.dot(matrix)
    return result

twelve = project(avg, 12)
twelve.style.format("{:.1%}")
""")

code(r"""
# The PD building up month by month — the default column ("91+ DPD") at each step.
power, rows = avg.copy(), {}
for n in range(1, 13):
    rows[n] = power["91+ DPD"]
    power = power.dot(avg)

horizon = pd.DataFrame(rows).T
horizon.index.name = "months ahead"
horizon.style.format("{:.1%}")
""")

talk(r"""
> **▶ SAY:** "One line does the twelve multiplications. Quick caveat you can phrase
> in your own words — it assumes each month behaves about the same. You'll explain
> that side better than me."
""")

# ==========================================================================
# 3.1 — TTC PD
# ==========================================================================
md(r"""
---
## 8 · Through-the-Cycle PD (TTC PD)

The answer is the **last column** of the 12-step matrix — the default column
(`"91+ DPD"`). That column *is* the 12-month PD for each aging bucket. This table is
the end output of the whole session.
""")

code(r"""
ttc = pd.DataFrame({"Aging bucket": LABELS, "12-month TTC PD": twelve["91+ DPD"].values})
ttc.style.format({"12-month TTC PD": "{:.2%}"}).hide(axis="index")
""")

talk(r"""
> **▶ SAY:** "This is the deliverable — one PD per bucket, straight from the last
> column of the matrix. On the real portfolio these are 11.64, 37.83, 48.87, 75.67,
> 100. Lower here (sample data), but they climb the same way: further behind today,
> higher the PD."
""")

# ==========================================================================
# HISTORICAL DEFAULT RATE
# ==========================================================================
md(r"""
---
## 9 · Compare against actual defaults

A quick reality check, no chart needed. The model's bucket-0 PD is a
*through-the-cycle average*, so it should land near the **average** of the observed
default rate we built in step 5 — sitting in the middle of the range, not tracking
any single year.
""")

code(r"""
model_pd = twelve.loc["0 DPD", "91+ DPD"]   # model's bucket-0 12-month PD

print(f"Model bucket-0 TTC PD : {model_pd:.2%}")
print(f"Observed ODR, average : {odr['odr'].mean():.2%}")
print(f"Observed ODR, range   : {odr['odr'].min():.2%} to {odr['odr'].max():.2%}")
""")

talk(r"""
> **▶ SAY:** "The model's number sits near the average of what actually happened —
> that's the check. It doesn't track any single year, because it's a
> through-the-cycle average."
""")

# ==========================================================================
# RECAP
# ==========================================================================
md(r"""
---
## What you just did — the Transition Matrix, in Python

| Step | The pandas |
|---|---|
| 1 · Consolidate | `read_excel`, `concat` |
| Data validation | required columns, duplicates, types, missing % |
| 2 · Pivot | `pivot_table` |
| 3 · Bucket | a function + `.apply()` |
| 4 · Everbad | a loop carrying state (`.cummax`) |
| 5 · Default rate (ODR) | boolean masks, `.isin()`, `.sum()` |
| 6 · Build the matrix | boolean-mask counts, `.div()`, `concat` + `groupby().mean()` |
| 7 · Markov | `.dot()` in a loop |
| 8 · TTC PD | the `"91+ DPD"` column of the 12-step matrix |
| 9 · Compare vs actual | `.mean()`, `.min()`, `.max()` |

**One library, pandas — nothing else.** The hard part was never the syntax — it was
**knowing what shape the data needs to be in** at each step.

### Three things to remember
1. **Check the shape after every step.** `df.shape` catches most bugs instantly.
2. **A blank means something.** Here it's "not on the book" → the Indeterminate
   group. Decide what missing means before you handle it.
3. **Every model has one assumption that moves the answer.** Here it's everbad —
   find it, and be able to say out loud what it costs.

### Reuse it in your own work
The whole process is packaged as functions in **`transition_matrix.py`**:

```python
import transition_matrix as tm
avg, projected, ttc = tm.run_pipeline()   # point at your data via DATA_ROOT
print(ttc)                                 # 12-month TTC PD by aging bucket
```

### Point it at your real data
Set `DATA_ROOT` to the real archive (one sub-folder per year) and make sure the
four columns are named `pn_number`, `loan_segment`, `report_date`, `dpd`. On the
real portfolio the TTC PD reads **11.64% / 37.83% / 48.87% / 75.67% / 100%**.

### Where this fits
This is the **Transition Matrix** — one part of the wider ECL work. The steps that
come after it (net flow rate, ECL, and the rest) are covered in the other sessions
in this series.
""")

talk(r"""
> **▶ Close (in your own words):** "So that's the whole Transition Matrix, start to
> finish, in something you can read top to bottom. It's only a handful of steps, and
> every judgement call ends up as one visible block of code."
>
> **▶ Hand off:** "This is where my part stops. The pieces after this — net flow
> rate, ECL, and the rest — my colleagues will take you through in their sessions."
>
> **▶ Q&A likely to come up:**
> - *"Why 7.6% here, 11.64% on ours?"* Different data — sample vs real. Same method;
>   the real 2020 stress was sharper (point at the last chart).
> - *"Can it read our real files?"* Yes — set `DATA_ROOT`, keep the 4 column names.
> - *"Segment-level matrices?"* Filter `panel`/`buckets` by `loan_segment` first,
>   then the same steps. Happy to build it as a follow-up.
""")

# ==========================================================================
# WRITE OUT
# ==========================================================================
def notebook(cells):
    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python",
                           "name": "python3"},
            "language_info": {"name": "python"},
        },
        "nbformat": 4, "nbformat_minor": 5,
    }


HERE = Path(__file__).resolve().parent
(HERE / "Transition_Matrix_FACILITATOR.ipynb").write_text(
    json.dumps(notebook(FAC), indent=1))
(HERE / "Transition_Matrix_RISK_LIVE.ipynb").write_text(
    json.dumps(notebook(RISK), indent=1))

print(f"Wrote FACILITATOR ({len(FAC)} cells) and RISK_LIVE ({len(RISK)} cells).")
