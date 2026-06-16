"""
Seasonal differencing order (D) selection matching R's forecast::auto.arima.

pmdarima only ships the OCSB and CH seasonal tests, both of which are
conservative and frequently return D=0 on short series (~3 seasonal cycles).
R's `auto.arima` defaults to `seasonal.test = "seas"`, the Wang-Smith-Hyndman
seasonal-strength heuristic, which detects recurring seasonal patterns those
tests miss. The mismatch causes pmdarima to skip seasonal models entirely and
produce flat forecasts where R produces a seasonal/trending forecast.

This module reimplements R's `nsdiffs(x, test = "seas")` so the Python tool
selects the same D as the R reference script.
"""
import numpy as np
import pandas as pd
from statsmodels.tsa.seasonal import STL


def seasonal_strength(values, m):
    """
    Wang-Smith-Hyndman seasonal strength of a series.

    Fs = max(0, 1 - Var(remainder) / Var(seasonal + remainder)) from an STL
    decomposition. Mirrors the `seas.heuristic` used by R's forecast::nsdiffs.
    """
    values = np.asarray(values, dtype=float)
    values = values[~np.isnan(values)]
    if len(values) < 2 * m:
        return 0.0
    try:
        res = STL(pd.Series(values), period=m, robust=True).fit()
    except Exception:
        return 0.0
    seasonal = np.asarray(res.seasonal)
    remainder = np.asarray(res.resid)
    var_sr = np.var(seasonal + remainder)
    if var_sr <= 0:
        return 0.0
    return max(0.0, 1.0 - np.var(remainder) / var_sr)


def seas_nsdiffs(values, m, max_D=1, threshold=0.64):
    """
    Number of seasonal differences (D) using R's `seas` test.

    Iteratively measures seasonal strength; while it exceeds `threshold`
    (R's default 0.64), increments D and seasonally differences, up to `max_D`
    (R's default for monthly/quarterly is 1).
    """
    if m <= 1:
        return 0
    series = np.asarray(values, dtype=float)
    series = series[~np.isnan(series)]
    D = 0
    while D < max_D:
        if len(series) < 2 * m:
            break
        if seasonal_strength(series, m) <= threshold:
            break
        D += 1
        series = pd.Series(series).diff(m).dropna().to_numpy()
    return D
