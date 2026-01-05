# ARIMA MEVs Forecast R Scripts - Parameters Documentation

## Overview
This document explains the parameters required for the two ARIMA forecasting R scripts:
1. `01 ASAPFI MEVs Forecast R Script_Monthly MEVs.R`
2. `02 ASAPFI MEVs Forecast R Script_Quarterly MEVs.R`

## Parameters Required

### Script 01: Monthly MEVs Forecast

The script requires the following **hardcoded parameters** (lines 18-24):

```r
start_year = 2012              # Start year for the time series
end_year = 2025                # End year for the historical data (adjust for extending data points)
frequency = 12                  # 12 for monthly MEVs (fixed)
start_month = 1                # Starting month (1-12, where 1 = January)
end_month = 9                  # Ending month for historical data (1-12, adjust for extending data points)
month_to_forecast = 12         # Number of months to forecast ahead
```

**File Paths (hardcoded):**
- **Input**: `"Input/MEV Historical Monthly Data.xlsx"` (line 30)
- **Output**: `"Output/ASAPFI Forecasts Monthly MEVs.xlsx"` (line 60)

---

### Script 02: Quarterly MEVs Forecast

The script requires the following **hardcoded parameters** (lines 18-24):

```r
start_year = 2012              # Start year for the time series
end_year = 2025                # End year for the historical data (adjust for extending data points)
frequency = 4                   # 4 for quarterly MEVs (fixed)
start_quarter = 1              # Starting quarter (1-4, where 1 = Q1)
end_quarter = 3                # Ending quarter for historical data (1-4, adjust for extending data points)
quarter_to_forecast = 5        # Number of quarters to forecast ahead
```

**File Paths (hardcoded):**
- **Input**: `"Input/MEV Historical Quarterly Data.xlsx"` (line 30)
- **Output**: `"Output/ASAPFI Forecasts Quarterly MEVs.xlsx"` (line 60)

---

## Parameter Descriptions

### Time Series Parameters

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `start_year` | Integer | Any year | The year when the historical time series begins |
| `end_year` | Integer | Any year ≥ start_year | The year when the historical time series ends |
| `start_month` | Integer | 1-12 | Starting month (1=Jan, 2=Feb, ..., 12=Dec) - **Monthly script only** |
| `end_month` | Integer | 1-12 | Ending month for historical data - **Monthly script only** |
| `start_quarter` | Integer | 1-4 | Starting quarter (1=Q1, 2=Q2, 3=Q3, 4=Q4) - **Quarterly script only** |
| `end_quarter` | Integer | 1-4 | Ending quarter for historical data - **Quarterly script only** |

### Forecast Parameters

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `month_to_forecast` | Integer | ≥ 1 | Number of months to forecast into the future - **Monthly script only** |
| `quarter_to_forecast` | Integer | ≥ 1 | Number of quarters to forecast into the future - **Quarterly script only** |

### Fixed Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `frequency` (Monthly) | 12 | Monthly frequency (12 months per year) |
| `frequency` (Quarterly) | 4 | Quarterly frequency (4 quarters per year) |

---

## Input File Format Requirements

### Monthly Input File: `MEV Historical Monthly Data.xlsx`

**Structure:**
- First row is typically headers/metadata (will be removed by script)
- Each column represents a different MEV (Macro Economic Variable)
- Each row represents a monthly observation
- Data should be numeric

**Example columns:**
- `unemp_rate` (unemployment rate)
- `gdp` (GDP)
- `rrp_rate` (RRP rate)
- `gni_growth_12m` (GNI growth 12 months)
- etc.

### Quarterly Input File: `MEV Historical Quarterly Data.xlsx`

**Structure:**
- First row is typically headers/metadata (will be removed by script)
- Each column represents a different MEV (Macro Economic Variable)
- Each row represents a quarterly observation
- Data should be numeric

---

## Output Format

Both scripts generate Excel files with:

1. **Date column**: Formatted as "YYYY MMM" (e.g., "2012 Jan", "2025 Sep")
2. **Forecast columns for each variable**: 
   - `{variable_name}_Point Forecast` - Point forecast
   - `{variable_name}_Lo 80` - Lower bound of 80% confidence interval
   - `{variable_name}_Hi 80` - Upper bound of 80% confidence interval
   - `{variable_name}_Lo 95` - Lower bound of 95% confidence interval
   - `{variable_name}_Hi 95` - Upper bound of 95% confidence interval

3. **Combined data**: Historical actuals + forecasted values

---

## Example Payload Structure (if converted to API)

If these scripts were to be called via an API endpoint, the payload would look like:

### Monthly Forecast Payload:
```json
{
  "input_file_path": "Input/MEV Historical Monthly Data.xlsx",
  "output_file_path": "Output/ASAPFI Forecasts Monthly MEVs.xlsx",
  "start_year": 2012,
  "end_year": 2025,
  "start_month": 1,
  "end_month": 9,
  "months_to_forecast": 12
}
```

### Quarterly Forecast Payload:
```json
{
  "input_file_path": "Input/MEV Historical Quarterly Data.xlsx",
  "output_file_path": "Output/ASAPFI Forecasts Quarterly MEVs.xlsx",
  "start_year": 2012,
  "end_year": 2025,
  "start_quarter": 1,
  "end_quarter": 3,
  "quarters_to_forecast": 5
}
```

---

## ARIMA Model Configuration

Both scripts use the same ARIMA model settings:

```r
auto.arima(data.ts, allowdrift = FALSE, seasonal = TRUE)
```

- **`allowdrift = FALSE`**: No drift term in the model
- **`seasonal = TRUE`**: Includes seasonal components
- **Automatic selection**: The `auto.arima()` function automatically selects the best ARIMA model parameters (p, d, q) and seasonal parameters (P, D, Q)

---

## Notes

1. **Data Extension**: When extending historical data, adjust `end_year` and `end_month`/`end_quarter` accordingly
2. **Forecast Horizon**: Adjust `month_to_forecast` or `quarter_to_forecast` to change how far into the future to forecast
3. **File Paths**: Currently hardcoded relative paths. Ensure the script is run from the correct working directory
4. **Data Quality**: The script expects numeric data. Non-numeric values may cause errors

---

## Python Equivalent

The Python versions of these scripts (`asapfi_mevs_forecast_monthly.py` and `asapfi_mevs_forecast_quarterly.py`) accept the same parameters as function arguments, making them more flexible for API integration.

