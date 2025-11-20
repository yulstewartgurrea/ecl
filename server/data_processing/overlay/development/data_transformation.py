import os
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from datetime import datetime
from itertools import combinations, product
from multiprocessing import Pool, cpu_count
from functools import partial

from statsmodels.tsa.stattools import adfuller

from helpers.get_root_folder import get_root_folder
from helpers.get_time_date import get_time_date

from data.excluded_columns import excluded_columns

import time


# ----------------------------- Utilities & Cleaning ----------------------------- #

def clean_numeric_like_series(s: pd.Series) -> pd.Series:
    """
    Make a best-effort parse of a column that might contain numbers in any of:
      - "1,234.56"
      - "(1,234.56)"  -> -1234.56
      - "12%"         -> 0.12
      - " -  "        -> NaN
    """
    s = s.astype(str).str.strip()
    # (1234) -> -1234
    s = s.str.replace(r'^\((.*)\)$', r'-\1', regex=True)
    # remove thousands separators
    s = s.str.replace(',', '', regex=False)

    # split percents vs non-percents
    is_percent = s.str.contains('%', na=False)
    # percents -> strip '%' then /100
    s_pct = s[is_percent].str.replace('%', '', regex=False)
    s_pct_num = pd.to_numeric(s_pct, errors='coerce') / 100.0
    # non-percents -> direct to_numeric
    s_nonpct_num = pd.to_numeric(s[~is_percent], errors='coerce')

    out = pd.concat([s_pct_num, s_nonpct_num]).sort_index()
    return out


def clean_percentage_data(df: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Clean all non-excluded columns with robust numeric parser.
    Leaves truly non-numeric columns unchanged.
    """
    df = df.copy()
    for col in df.columns:
        if col in excluded_columns:
            continue
        try:
            df[col] = clean_numeric_like_series(df[col])
        except Exception:
            pass  # keep as-is if truly non-numeric
    return df


# ----------------------------- Merge & Prep ----------------------------- #

def combine_monthly_mev_data_interpolation(monthly_historical_mev_df: pd.DataFrame,
                                           data_interpolation_df: pd.DataFrame) -> pd.DataFrame | None:
    """
    Left-join on 'id', strip definitions rows (index 1 & 2), and normalize columns.
    More defensive drops/renames to survive slight column name differences.
    """
    try:
        df_interpolation = data_interpolation_df.copy()
        df_monthly = monthly_historical_mev_df.copy()

        # definition rows (first 2 rows) exist in both inputs; keep but will drop post-merge
        df_combined = pd.merge(df_interpolation, df_monthly, on='id', how='left')

        # Drop definition rows at indices 1 and 2 (0-based)
        df_combined = df_combined.drop([1, 2], errors='ignore').reset_index(drop=True)

        # Clean merge artifacts safely
        df_combined = df_combined.drop(columns=[c for c in ['month_x', 'year_y'] if c in df_combined.columns], errors='ignore')
        rename_map = {}
        if 'year_x' in df_combined.columns: rename_map['year_x'] = 'year'
        if 'month_y' in df_combined.columns: rename_map['month_y'] = 'month'
        df_combined = df_combined.rename(columns=rename_map)

        # Reorder identifiers first if present
        id_cols = [c for c in ['year', 'month (int)', 'month', 'quarter', 'id', 'x'] if c in df_combined.columns]
        other_cols = [c for c in df_combined.columns if c not in id_cols]
        df_combined = df_combined[id_cols + other_cols]

        return df_combined

    except Exception as e:
        print(f"❌ Error during combination: {str(e)}")
        import traceback; traceback.print_exc()
        return None


def prepare_independent_variables(df: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Build Time = YYYY-MM, drop first 2 rows (definitions), and clean numerics.
    """
    print("Preparing independent variables...")
    x_raw = df.copy()

    # Time as YYYY-MM from year + month (int)
    if 'year' in x_raw.columns and 'month (int)' in x_raw.columns:
        x_raw['Time'] = pd.to_datetime({
            'year':  pd.to_numeric(x_raw['year'], errors='coerce'),
            'month': pd.to_numeric(x_raw['month (int)'], errors='coerce'),
            'day':   1
        }, errors='coerce').dt.strftime('%Y-%m')
    elif 'Time' not in x_raw.columns:
        raise ValueError("Cannot create Time column: missing 'year' and 'month (int)'.")

    # Remove first 2 definition rows
    x_raw = x_raw.iloc[2:].reset_index(drop=True)

    # Clean numerics
    x_raw = clean_percentage_data(x_raw, excluded_columns)
    return x_raw


def add_level_gr_columns(x_raw: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Create .Level (the level itself) and .GR (YoY growth) for each *raw* base var.
    This mirrors the R pipeline assumption that .Level/.GR columns may exist.
    """
    x = x_raw.copy()
    # base vars = non-excluded and no dot suffix
    raw_vars = [c for c in x.columns if c not in excluded_columns and '.' not in c and c.lower() not in ('time',)]
    for v in raw_vars:
        base = pd.to_numeric(x[v], errors='coerce')
        lvl_col = f"{v}.Level"
        gr_col  = f"{v}.GR"
        if lvl_col not in x.columns:
            x[lvl_col] = base
        if gr_col not in x.columns:
            x[gr_col] = base / base.shift(12) - 1
    return x


def prepare_dependent_variables(df: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Clean numerics, clip the FIRST non-excluded series (mirrors y_raw[,2] in R),
    (0 -> 0.001, 1 -> 0.99999), then build Time from 'time' column.
    """
    print("Preparing dependent variables...")
    y_raw = df.copy()

    y_raw = clean_percentage_data(y_raw, excluded_columns)

    # Select target by position like R's y_raw[,2]
    candidates = [c for c in y_raw.columns if c not in excluded_columns and c.lower() != 'time']
    if not candidates:
        raise ValueError("No dependent variable column found.")
    target = candidates[0]

    y_raw[target] = y_raw[target].replace(0, 0.001).replace(1, 0.99999)

    # Time column (expects a 'time' column with parseable dates)
    if 'time' in y_raw.columns:
        y_raw['Time'] = pd.to_datetime(y_raw['time'], errors='coerce').dt.strftime('%Y-%m')
    elif 'Time' not in y_raw.columns:
        raise ValueError("Dependent data missing 'time' column to derive 'Time'.")

    return y_raw


# ----------------------------- Transformations ----------------------------- #

def apply_transformations_to_independent_variables(x_raw: pd.DataFrame,
                                                   x_raw_vars: list,
                                                   excluded_columns: list) -> pd.DataFrame:
    """
    - ln to raw vars with strictly positive min
    - asinh to raw vars with non-positive values
    - diff_12 to ALL columns (raw + transformed)
    - lags 3/6/9/12 to ALL columns (raw + transformed)
    """
    print("Applying transformations to independent variables...")
    x_transformed = x_raw.copy()

    # ln
    print("Applying log transformations...")
    for var in x_raw_vars:
        try:
            s = pd.to_numeric(x_raw[var], errors='coerce')
            if not s.isna().all() and s.min(skipna=True) > 0:
                x_transformed[f"{var}.ln"] = np.log(s)
        except Exception as e:
            print(f"  ln skip {var}: {e}")

    # asinh
    print("Applying asinh transformations...")
    for var in x_raw_vars:
        try:
            s = pd.to_numeric(x_raw[var], errors='coerce')
            if not s.isna().all() and s.min(skipna=True) <= 0:
                x_transformed[f"{var}.asinh"] = np.arcsinh(s)
        except Exception as e:
            print(f"  asinh skip {var}: {e}")

    # diff_12 on ALL non-excluded
    print("Applying differencing transformations...")
    all_vars_to_diff = [c for c in x_transformed.columns if c not in excluded_columns]
    for col in all_vars_to_diff:
        try:
            s = pd.to_numeric(x_transformed[col], errors='coerce')
            if not s.isna().all():
                x_transformed[f"{col}.diff_12"] = s - s.shift(12)
        except Exception as e:
            print(f"  diff_12 skip {col}: {e}")

    # lags on ALL non-excluded
    print("Applying lag transformations...")
    lag_periods = [3, 6, 9, 12]
    all_vars_to_lag = [c for c in x_transformed.columns if c not in excluded_columns]
    for col in all_vars_to_lag:
        s = pd.to_numeric(x_transformed[col], errors='coerce')
        if s.isna().all():
            continue
        for lag in lag_periods:
            try:
                x_transformed[f"{col}.lag_{lag}"] = s.shift(lag)
            except Exception as e:
                print(f"  lag_{lag} skip {col}: {e}")

    all_transformed_vars = [c for c in x_transformed.columns if c not in excluded_columns]
    print(f"Total transformed variables: {len(all_transformed_vars)}")
    print(f"Sample transformed variables: {all_transformed_vars[:10]}")
    return x_transformed


def apply_transformations_to_dependent_variables(y_raw: pd.DataFrame, y_raw_vars: list) -> pd.DataFrame:
    """
    logit for all dependent vars in y_raw_vars.
    """
    print("Applying transformations to dependent variables...")
    y_transformed = y_raw.copy()
    for var in y_raw_vars:
        try:
            s = pd.to_numeric(y_raw[var], errors='coerce')
            if not s.isna().all():
                y_transformed[f"{var}.logit"] = np.log(s / (1 - s))
        except Exception as e:
            print(f"  logit skip {var}: {e}")
    return y_transformed


# ----------------------------- ADF & Correlation ----------------------------- #

def perform_adf_tests(x_transformed: pd.DataFrame,
                      y_transformed: pd.DataFrame,
                      excluded_columns: list,
                      output_dir: str,
                      workflow,
                      _date_time: str,
                      docs: list):
    def adf_tester(series, alt_hyp="stationary", lag_order=None, trend='c'):
        try:
            s = pd.to_numeric(pd.Series(series), errors='coerce').dropna()
            if len(s) < 4:
                return {"p.value": float('inf'), "statistic": float('inf')}
            if lag_order is None:
                lag_order = int((len(s) - 1) ** (1/3))
            lag_order = max(0, min(lag_order, len(s) - 2))
            stat, pval, *_ = adfuller(
                s.values,
                maxlag=lag_order,
                regression=trend,
                autolag=None
            )
            return {"p.value": float(pval), "statistic": float(stat)}
        except Exception:
            return {"p.value": np.inf, "statistic": np.inf}

    print("Performing ADF tests...")

    x_vars_for_adf = [c for c in x_transformed.columns if c not in excluded_columns and c.lower() != 'time']
    y_vars_for_adf = [c for c in y_transformed.columns if c not in excluded_columns and c.lower() != 'time']

    adf_df_x = pd.DataFrame([
        {"var_name": var, **adf_tester(x_transformed[var])} for var in x_vars_for_adf
    ])
    adf_df_x.to_csv(f"{output_dir}/{workflow.loan_product}_ADF_test_x_{_date_time}.csv", index=False)
    docs.append(f"{workflow.loan_product}_ADF_test_x_{_date_time}.csv")

    adf_df_y = pd.DataFrame([
        {"var_name": var, **adf_tester(y_transformed[var])} for var in y_vars_for_adf
    ])
    adf_df_y.to_csv(f"{output_dir}/{workflow.loan_product}_ADF_test_y_{_date_time}.csv", index=False)
    docs.append(f"{workflow.loan_product}_ADF_test_y_{_date_time}.csv")

    return adf_df_x, adf_df_y


def compute_correlation_matrix(x_transformed: pd.DataFrame,
                               excluded_columns: list,
                               output_dir: str,
                               workflow,
                               _date_time: str,
                               docs: list) -> pd.DataFrame:
    """
    Corr on numeric-only subset (pairwise complete obs).
    """
    print("Computing correlation matrix...")
    X = x_transformed.drop(columns=excluded_columns, errors='ignore')
    X = X.select_dtypes(include=[np.number])  # numeric only
    print(f"Correlation numeric columns: {X.shape[1]}")
    x_cor_mat = X.corr(method='pearson')  # pairwise by default

    cor_df = pd.DataFrame(x_cor_mat)
    cor_df.index.name = "name"
    cor_df.to_csv(f"{output_dir}/{workflow.loan_product}_x_cor_mat_{_date_time}.csv")
    docs.append(f"{workflow.loan_product}_x_cor_mat_{_date_time}.csv")
    return x_cor_mat


# ----------------------------- Combinations ----------------------------- #

def generate_variable_combinations(x_raw_vars: list,
                                   x_transformed: pd.DataFrame,
                                   excluded_columns: list) -> list[list[str]]:
    """
    Mirrors the R expansion:
      base (raw) -> append "", ".Level", ".GR" -> filter exists
                   -> append "", ".ln", ".asinh" -> filter exists
                   -> append "", ".diff_12" -> filter exists
                   -> append "", ".lag_3/_6/_9/_12" -> filter exists
    """
    print("Generating variable combinations...")

    # base names (raw should not have '.')
    x_base_vars = list(set([v.split('.')[0] for v in x_raw_vars]))
    print(f"Base variables: {len(x_base_vars)}")

    num_vars_taken = 2
    comb_no_lags = list(combinations(x_base_vars, num_vars_taken))
    comb_extended = [list(c) for c in comb_no_lags]
    print(f"Base combinations: {len(comb_extended)}")

    # Level/GR
    print("Applying Level/GR permutations...")
    level_gr_options = ["", ".Level", ".GR"]
    level_gr_perms = list(product(level_gr_options, repeat=num_vars_taken))

    new_ext = []
    for base_comb in comb_extended:
        for p in level_gr_perms:
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            new_ext.append(names)
    comb_extended = [c for c in new_ext if all(v in x_transformed.columns for v in c)]
    print(f"Valid Level/GR combinations: {len(comb_extended)}")
    if not comb_extended:
        print("No valid Level/GR combinations; check .Level/.GR creation.")

    # Transformations
    print("Applying transformation permutations...")
    trans_options = ["", ".ln", ".asinh"]
    trans_perms = list(product(trans_options, repeat=num_vars_taken))

    new_ext = []
    for base_comb in comb_extended:
        for p in trans_perms:
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            new_ext.append(names)
    comb_extended = [c for c in new_ext if all(v in x_transformed.columns for v in c)]
    print(f"Valid transformation combinations: {len(comb_extended)}")

    # Differencing
    print("Applying differencing permutations...")
    diff_options = ["", ".diff_12"]
    diff_perms = list(product(diff_options, repeat=num_vars_taken))

    new_ext = []
    for base_comb in comb_extended:
        for p in diff_perms:
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            new_ext.append(names)
    comb_extended = [c for c in new_ext if all(v in x_transformed.columns for v in c)]
    print(f"Valid differencing combinations: {len(comb_extended)}")

    # Lags
    print("Applying lag permutations...")
    lag_options = ["", ".lag_3", ".lag_6", ".lag_9", ".lag_12"]
    lag_perms = list(product(lag_options, repeat=num_vars_taken))

    new_ext = []
    for base_comb in comb_extended:
        for p in lag_perms:
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            new_ext.append(names)
    comb_extended = [c for c in new_ext if all(v in x_transformed.columns for v in c)]
    print(f"Valid lag combinations: {len(comb_extended)}")

    print(f"Generated {len(comb_extended)} total valid combinations")
    return comb_extended


# ----------------------------- Max-corr for combos ----------------------------- #

def process_combination_with_cor_mat(cor_mat: pd.DataFrame, combination: list[str]) -> tuple[list[str], float]:
    """
    Return (combination, max_abs_cor) for a given set of variables.
    """
    try:
        missing = [v for v in combination if v not in cor_mat.index]
        if missing:
            return combination, np.nan
        sub = cor_mat.loc[combination, combination]
        if sub.empty or sub.shape[0] != len(combination):
            return combination, np.nan

        # off-diagonal
        mask = np.ones_like(sub, dtype=bool)
        np.fill_diagonal(mask, False)
        off = sub.where(mask).stack().dropna()
        if off.empty:
            return combination, np.nan

        max_cor = np.abs(off).max()
        if pd.isna(max_cor) or np.isinf(max_cor):
            return combination, np.nan
        return combination, float(max_cor)

    except Exception:
        return combination, np.nan


def compute_correlations_for_combinations(all_combinations: list[list[str]],
                                          x_cor_mat: pd.DataFrame,
                                          num_vars_taken: int) -> pd.DataFrame:
    """
    Parallel compute max |corr| per combination (Windows-safe: function is global).
    """
    print("Computing maximum correlations for all combinations...")
    if not all_combinations:
        return pd.DataFrame(columns=[f"X{i+1}" for i in range(num_vars_taken)] + ["max_abs_cor"])

    num_cores = max(1, cpu_count())
    print(f"Using {num_cores} CPU cores for parallel processing")

    with Pool(processes=num_cores) as pool:
        process_func = partial(process_combination_with_cor_mat, x_cor_mat)
        results = pool.map(process_func, all_combinations)

    print(f"Processed {len(results)} combinations")

    rows = []
    for comb, max_cor in results:
        row = {f"X{i+1}": comb[i] for i in range(num_vars_taken)}
        row["max_abs_cor"] = max_cor
        rows.append(row)
    all_comb_df = pd.DataFrame(rows)
    print(f"Correlation results: {all_comb_df['max_abs_cor'].notna().sum()} valid, {all_comb_df['max_abs_cor'].isna().sum()} NaN")
    return all_comb_df


# ----------------------------- Orchestration ----------------------------- #

def process_data_transformation_output(combine_monthly_mev_data_interpolation_df: pd.DataFrame,
                                       historical_default_rate_df: pd.DataFrame,
                                       workflow):
    """
    Full pipeline: clean -> add .Level/.GR -> transforms -> ADF -> corr -> combos -> combo corr
    """
    _date_time = get_time_date()

    docs = []

    output_dir = (
        f"{get_root_folder()}/files/"
        f"{workflow.entity}/"
        f"{workflow.reporting_period}/"
        f"{workflow.workflow_name}/"
        f"output/overlay/development/{workflow.loan_product}/data_transformation"
    )
    os.makedirs(output_dir, exist_ok=True)

    # 1) Prep
    x_raw = prepare_independent_variables(combine_monthly_mev_data_interpolation_df, excluded_columns)
    x_raw = add_level_gr_columns(x_raw, excluded_columns)  # NEW: provide .Level and .GR
    y_raw = prepare_dependent_variables(historical_default_rate_df, excluded_columns)

    # variable lists (raw vars only; no dot suffix)
    x_raw_vars = [c for c in x_raw.columns if c not in excluded_columns and '.' not in c and c.lower() != 'time']
    y_raw_vars = [c for c in y_raw.columns if c not in excluded_columns and c.lower() != 'time']

    print(f"Loaded {len(x_raw_vars)} independent raw variables and {len(y_raw_vars)} dependent variables")

    # 2) Transforms
    x_transformed = apply_transformations_to_independent_variables(x_raw, x_raw_vars, excluded_columns)
    y_transformed = apply_transformations_to_dependent_variables(y_raw, y_raw_vars)

    # 3) Save transformed
    x_out = f"{output_dir}/{workflow.loan_product}_Independent - Transformed with Time_{_date_time}.csv"
    y_out = f"{output_dir}/{workflow.loan_product}_Dependent - Transformed with Time_{_date_time}.csv"
    x_transformed.to_csv(x_out, index=False); docs.append(os.path.basename(x_out))
    y_transformed.to_csv(y_out, index=False); docs.append(os.path.basename(y_out))

    # 4) ADF + Corr
    perform_adf_tests(x_transformed, y_transformed, excluded_columns, output_dir, workflow, _date_time, docs)
    x_cor_mat = compute_correlation_matrix(x_transformed, excluded_columns, output_dir, workflow, _date_time, docs)

    # 5) Combos + combo max corr
    all_combinations = generate_variable_combinations(x_raw_vars, x_transformed, excluded_columns)
    num_vars_taken = 2
    all_comb_df = compute_correlations_for_combinations(all_combinations, x_cor_mat, num_vars_taken)

    comb_out = f"{output_dir}/{workflow.loan_product}_{num_vars_taken}-var_combinations_{_date_time}.csv"
    all_comb_df.to_csv(comb_out, index=False); docs.append(os.path.basename(comb_out))

    # 6) Summary
    print("Data transformation complete!")
    print(f"Results saved to {output_dir}/")
    print(f"Total combinations processed: {len(all_combinations)}")

    if not all_comb_df.empty and 'max_abs_cor' in all_comb_df.columns:
        valid_cor = all_comb_df['max_abs_cor'].dropna()
        if not valid_cor.empty:
            print(f"- Average max correlation: {valid_cor.mean():.4f}")
            print(f"- Min max correlation: {valid_cor.min():.4f}")
            print(f"- Max max correlation: {valid_cor.max():.4f}")
            print(f"- Valid correlations: {len(valid_cor)}/{len(all_comb_df)}")

    return {"docs": docs, "file_path": output_dir}


def process_data_transformation(monthly_historical_mev_df: pd.DataFrame,
                                data_interpolation_df: pd.DataFrame,
                                historical_default_rates_df: pd.DataFrame,
                                workflow):
    """
    Entrypoint used by the app.
    """
    print("🔄 Starting dataframe combination process...")
    start_time = time.time()  # Start the timer
    try:
        df_combined = combine_monthly_mev_data_interpolation(monthly_historical_mev_df, data_interpolation_df)
        res = process_data_transformation_output(df_combined, historical_default_rates_df, workflow)
        end_time = time.time()  # End the timer
        elapsed_time = end_time - start_time  # Calculate elapsed time
        print(f"✅ Data transformation completed in {elapsed_time:.2f} seconds.")
        return res
    except Exception as e:
        print(f"❌ Error during combination: {str(e)}")
        import traceback; traceback.print_exc()
        return None