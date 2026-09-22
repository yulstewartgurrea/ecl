#!/usr/bin/env python3
"""
Generate synthetic "Transactional Report" files that mirror the structure of the
bank's real monthly extracts, for the Transition Matrix walkthrough notebook.

Output layout (mirrors the real archive):

    data/Transactional Data/<YEAR>/Transactional Report <Month> <Year>.xlsx

Each file is one month-end snapshot of the active loan book, with the same 12
columns as the real extract.

The simulated portfolio deliberately contains a credit cycle: a sharp
deterioration through 2020, a slow recovery from 2021, and a mild second
wobble in 2023.  That gives the notebook's charts something real to show and
makes the through-the-cycle vs point-in-time comparison meaningful.
"""

from __future__ import annotations

import calendar
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SEED = 20240101
YEARS = range(2020, 2025)          # 2020..2024 inclusive -> 60 monthly files
N_LOANS = 2_400                    # pool size; ~1,000 active in a given month
OUT_ROOT = Path(__file__).parent / "data" / "Transactional Data"

# The real extract does NOT carry these four columns, but Step 11 (Historical
# Default Rate) uses them for its Industry / Branch / Income / Age breakdowns.
# Set to False to match the real files exactly (Step 11 then shows portfolio
# totals only).
INCLUDE_STEP11_DIMENSIONS = True

SEGMENTS = [
    ("Salary Loan", 0.62),
    ("Business Loan", 0.23),
    ("Consumer Loan", 0.15),
]

ECONOMIC_ACTIVITIES = [
    "Wholesale & Retail Trade", "Agriculture", "Manufacturing",
    "Construction", "Transport & Storage", "Real Estate",
    "Accommodation & Food Service", "Education", "Other Services",
]
BRANCHES = [
    "Makati", "Quezon City", "Cebu", "Davao", "Iloilo",
    "Baguio", "Cagayan de Oro", "Batangas",
]
INCOME_RANGES = [
    "Below 15,000", "15,000 - 29,999", "30,000 - 49,999",
    "50,000 - 99,999", "100,000 and above",
]

# ---------------------------------------------------------------------------
# Credit-cycle transition matrices (monthly, bucket -> bucket)
# ---------------------------------------------------------------------------
# Buckets: 0 = current, 1 = 1-30 DPD, 2 = 31-60, 3 = 61-90, 4 = 91+ (default)
#
# Note bucket 4 is NOT absorbing here.  Real extracts do contain cures out of
# 90+ DPD; it is the pipeline's "everbad" rule (Step 6) that forces default to
# be absorbing.  Leaving cures in the raw data is what makes Step 6 visible.

P_BENIGN = np.array([
    [0.970, 0.024, 0.003, 0.002, 0.001],
    [0.620, 0.280, 0.070, 0.020, 0.010],
    [0.300, 0.260, 0.270, 0.130, 0.040],
    [0.150, 0.150, 0.220, 0.300, 0.180],
    [0.030, 0.040, 0.050, 0.100, 0.780],
])

P_STRESS = np.array([
    [0.905, 0.070, 0.013, 0.008, 0.004],
    [0.380, 0.330, 0.190, 0.070, 0.030],
    [0.150, 0.200, 0.290, 0.250, 0.110],
    [0.075, 0.105, 0.180, 0.325, 0.315],
    [0.018, 0.025, 0.040, 0.077, 0.840],
])


def stress_weight(d: date) -> float:
    """Return 0.0 (fully benign) .. 1.0 (fully stressed) for a month-end."""
    t = d.year + (d.month - 1) / 12.0
    if t < 2020.15:
        return 0.10
    if t < 2020.60:                      # Mar-Aug 2020: sharp deterioration
        return 0.10 + 0.72 * (t - 2020.15) / 0.45
    if t < 2021.00:                      # Sep-Dec 2020: peak stress
        return 0.82
    if t < 2022.50:                      # 2021 - mid 2022: recovery
        return 0.82 - 0.67 * (t - 2021.00) / 1.50
    if t < 2023.25:                      # mild second wobble
        return 0.15 + 0.30 * (t - 2022.50) / 0.75
    if t < 2023.75:
        return 0.45 - 0.30 * (t - 2023.25) / 0.50
    return 0.15


def transition_matrix_for(d: date) -> np.ndarray:
    w = stress_weight(d)
    return (1.0 - w) * P_BENIGN + w * P_STRESS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def month_ends(years) -> list[date]:
    out = []
    for y in years:
        for m in range(1, 13):
            out.append(date(y, m, calendar.monthrange(y, m)[1]))
    return out


def add_months(d: date, n: int) -> date:
    y, m = divmod((d.year * 12 + (d.month - 1)) + n, 12)
    m += 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def dpd_for_bucket(bucket: int, months_in_default: int, rng) -> int:
    if bucket == 0:
        return 0
    if bucket == 1:
        return int(rng.integers(1, 31))
    if bucket == 2:
        return int(rng.integers(31, 61))
    if bucket == 3:
        return int(rng.integers(61, 91))
    # 91+ : days past due keep accumulating the longer the account stays bad
    return int(91 + 30 * max(0, months_in_default - 1) + rng.integers(0, 10))


# ---------------------------------------------------------------------------
# Build the loan master
# ---------------------------------------------------------------------------

def build_loan_master(rng) -> pd.DataFrame:
    seg_names = [s for s, _ in SEGMENTS]
    seg_probs = np.array([p for _, p in SEGMENTS], dtype=float)
    seg_probs /= seg_probs.sum()

    horizon_start = date(2018, 1, 31)
    rows = []
    for i in range(N_LOANS):
        segment = str(rng.choice(seg_names, p=seg_probs))

        # Booking dates spread across 2015..2024 so loans enter and exit the
        # book over the observation window (this is what produces "NA" cells).
        booking = add_months(horizon_start, int(rng.integers(-36, 84)))
        term = int(rng.choice([24, 36, 48, 60, 72, 84], p=[.14, .26, .26, .18, .10, .06]))
        maturity = add_months(booking, term)

        if segment == "Business Loan":
            amount = float(rng.choice([300_000, 500_000, 800_000, 1_200_000,
                                       1_600_000, 2_200_000, 3_000_000]))
        elif segment == "Salary Loan":
            amount = float(rng.choice([50_000, 75_000, 100_000, 150_000,
                                       250_000, 500_000, 800_000]))
        else:
            amount = float(rng.choice([16_000, 35_000, 50_000, 73_326,
                                       90_000, 120_000, 200_000]))

        eir = round(float(rng.choice([0.07511, 0.10006, 0.11082, 0.11265,
                                      0.12504, 0.12913, 0.14548, 0.16244,
                                      0.16426, 0.16725, 0.18647, 0.20225,
                                      0.22253, 0.31459])), 5)

        monthly_rate = eir / 12.0
        if monthly_rate > 0:
            amort = amount * monthly_rate / (1 - (1 + monthly_rate) ** -term)
        else:
            amort = amount / term

        row = {
            "pn_number": f"PN{i + 1}",
            "cis_number": f"BR{int(rng.integers(100, 1300))}",
            "loan_segment": segment,
            "loan_amount": amount,
            "booking_date": booking,
            "maturity_date": maturity,
            "term_months": term,
            "eir": eir,
            "amortization": round(float(amort), 2),
        }

        if INCLUDE_STEP11_DIMENSIONS:
            row["economic_activity"] = str(rng.choice(ECONOMIC_ACTIVITIES))
            row["branch"] = str(rng.choice(BRANCHES))
            row["monthly_income_range"] = str(
                rng.choice(INCOME_RANGES, p=[.18, .30, .27, .18, .07])
            )
            row["age"] = int(rng.integers(22, 66))

        rows.append(row)

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Simulate the DPD panel
# ---------------------------------------------------------------------------

def simulate(master: pd.DataFrame, snapshots: list[date], rng) -> dict:
    """Return {month_end: DataFrame of active loans that month}."""
    matrices = {d: transition_matrix_for(d) for d in snapshots}

    # Per-loan running state
    state = {}
    for r in master.itertuples(index=False):
        state[r.pn_number] = {
            "bucket": 0,
            "months_bad": 0,
            "paid_ratio": float(rng.uniform(0.0, 0.25)),
        }

    per_month: dict[date, list[dict]] = {d: [] for d in snapshots}

    for snap in snapshots:
        P = matrices[snap]
        for r in master.itertuples(index=False):
            if not (r.booking_date <= snap <= r.maturity_date):
                continue

            st = state[r.pn_number]
            probs = P[st["bucket"]]
            new_bucket = int(rng.choice(5, p=probs))

            if new_bucket == 4:
                st["months_bad"] += 1
            else:
                st["months_bad"] = 0
            st["bucket"] = new_bucket

            dpd = dpd_for_bucket(new_bucket, st["months_bad"], rng)

            # Amortisation: performing loans pay down, delinquent ones stall.
            elapsed = (snap.year - r.booking_date.year) * 12 + (snap.month - r.booking_date.month)
            scheduled = min(1.0, max(0.0, elapsed / r.term_months))
            drag = {0: 1.0, 1: 0.92, 2: 0.78, 3: 0.60, 4: 0.35}[new_bucket]
            paid = min(0.995, scheduled * drag * float(rng.uniform(0.95, 1.05)))
            outstanding = round(r.loan_amount * (1.0 - paid), 2)

            # Mirrors the real extract, where monthly_payments is usually 0.
            payment = 0 if rng.random() < 0.93 else round(r.amortization * float(rng.uniform(0.8, 2.5)), 2)

            rec = {
                "report_date": snap,
                "loan_segment": r.loan_segment,
                "cis_number": r.cis_number,
                "pn_number": r.pn_number,
                "loan_amount": r.loan_amount,
                "outstanding_balance": outstanding,
                "amortization": r.amortization,
                "booking_date": r.booking_date,
                "maturity_date": r.maturity_date,
                "eir": r.eir,
                "monthly_payments": payment,
                "dpd": dpd,
            }
            if INCLUDE_STEP11_DIMENSIONS:
                rec["economic_activity"] = r.economic_activity
                rec["branch"] = r.branch
                rec["monthly_income_range"] = r.monthly_income_range
                rec["age"] = r.age

            per_month[snap].append(rec)

    return {d: pd.DataFrame(v) for d, v in per_month.items()}


# ---------------------------------------------------------------------------
# Write the archive
# ---------------------------------------------------------------------------

def main() -> None:
    rng = np.random.default_rng(SEED)

    print("Building loan master ...")
    master = build_loan_master(rng)

    snapshots = month_ends(YEARS)
    print(f"Simulating {len(master):,} loans across {len(snapshots)} month-ends ...")
    frames = simulate(master, snapshots, rng)

    if OUT_ROOT.exists():
        import shutil
        shutil.rmtree(OUT_ROOT)

    total_rows = 0
    for snap, df in frames.items():
        year_dir = OUT_ROOT / str(snap.year)
        year_dir.mkdir(parents=True, exist_ok=True)
        fname = f"Transactional Report {calendar.month_name[snap.month]} {snap.year}.xlsx"
        for col in ("report_date", "booking_date", "maturity_date"):
            df[col] = pd.to_datetime(df[col])
        df.to_excel(year_dir / fname, index=False, sheet_name="Sheet1")
        total_rows += len(df)

    print(f"\nWrote {len(frames)} files, {total_rows:,} rows total -> {OUT_ROOT}")

    # Quick sanity summary so a bad run is obvious immediately
    print("\nActive accounts and 91+ DPD share by year:")
    for y in YEARS:
        ds = [d for d in snapshots if d.year == y]
        n = int(np.mean([len(frames[d]) for d in ds]))
        bad = np.mean([(frames[d]["dpd"] > 90).mean() for d in ds]) * 100
        print(f"  {y}:  ~{n:,} active/month   {bad:5.2f}% at 91+ DPD")


if __name__ == "__main__":
    main()
