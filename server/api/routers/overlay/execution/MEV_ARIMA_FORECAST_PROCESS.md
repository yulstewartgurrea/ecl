# MEV ARIMA Forecast Process - Complete Guide

## Overview

This document explains the complete process for uploading MEV (Macro Economic Variable) historical data files and processing them through ARIMA forecasting models.

## Process Flow

### Step 1: Upload Historical MEV Data

Upload your historical MEV data files using the `/api/document/upload` endpoint with the following document types:

#### For Monthly Data:
- **Document Type**: `OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA`
- **File Format**: Excel (.xlsx, .xls) or CSV (.csv)
- **File Structure**: 
  - First row may contain headers/metadata (will be removed)
  - Each column represents a different MEV variable
  - Each row represents a monthly observation
  - Data should be numeric

#### For Quarterly Data:
- **Document Type**: `OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA`
- **File Format**: Excel (.xlsx, .xls) or CSV (.csv)
- **File Structure**: 
  - First row may contain headers/metadata (will be removed)
  - Each column represents a different MEV variable
  - Each row represents a quarterly observation
  - Data should be numeric

### Upload Endpoint

```
POST /api/document/upload
```

**Form Data:**
- `file`: The Excel/CSV file
- `document_type`: `OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA` or `OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA`
- `workflow_path`: Path to workflow directory (e.g., "Entity 1/Monthly/Workflow1")
- `workflow_id`: ID of the workflow
- `module`: Module name (e.g., "overlay")
- `submodule`: Submodule name (e.g., "execution")
- `override`: Boolean (optional, default: false)

**File Storage Location:**
After upload, files are stored at:
```
files/{entity}/{reporting_period}/{workflow_name}/input/overlay/execution/{loan_product}/OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA
files/{entity}/{reporting_period}/{workflow_name}/input/overlay/execution/{loan_product}/OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA
```

---

### Step 2: Process ARIMA Forecast

After uploading the historical data, trigger the forecast processing:

#### Monthly Forecast

```
POST /api/overlay/execution/mev_monthly_arima_forecast
```

**Form Data:**
- `workflow_id`: (required) Workflow ID
- `start_year`: (optional, default: 2012) Start year for time series
- `end_year`: (optional, default: 2025) End year for historical data
- `start_month`: (optional, default: 1) Start month (1-12)
- `end_month`: (optional, default: 9) End month for historical data (1-12)
- `months_to_forecast`: (optional, default: 12) Number of months to forecast ahead

**Example:**
```bash
curl -X POST "http://localhost:8000/api/overlay/execution/mev_monthly_arima_forecast" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "workflow_id=1" \
  -F "start_year=2012" \
  -F "end_year=2025" \
  -F "start_month=1" \
  -F "end_month=9" \
  -F "months_to_forecast=12"
```

#### Quarterly Forecast

```
POST /api/overlay/execution/mev_quarterly_arima_forecast
```

**Form Data:**
- `workflow_id`: (required) Workflow ID
- `start_year`: (optional, default: 2012) Start year for time series
- `end_year`: (optional, default: 2025) End year for historical data
- `start_quarter`: (optional, default: 1) Start quarter (1-4)
- `end_quarter`: (optional, default: 3) End quarter for historical data (1-4)
- `quarters_to_forecast`: (optional, default: 5) Number of quarters to forecast ahead

**Example:**
```bash
curl -X POST "http://localhost:8000/api/overlay/execution/mev_quarterly_arima_forecast" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "workflow_id=1" \
  -F "start_year=2012" \
  -F "end_year=2025" \
  -F "start_quarter=1" \
  -F "end_quarter=3" \
  -F "quarters_to_forecast=5"
```

**What Happens:**
1. The system finds the latest uploaded file in the input directory
2. Processes the file using ARIMA forecasting (auto.arima with seasonal components)
3. Generates forecasts for all MEV variables
4. Saves results to output directory
5. Stores results in database

**Output Location:**
```
files/{entity}/{reporting_period}/{workflow_name}/output/overlay/execution/{loan_product}/mev_monthly_arima_forecast
files/{entity}/{reporting_period}/{workflow_name}/output/overlay/execution/{loan_product}/mev_quarterly_arima_forecast
```

---

### Step 3: Retrieve Forecast Results

#### Get Monthly Forecast Results

```
GET /api/overlay/execution/mev_monthly_arima_forecast?workflow_id={workflow_id}
```

**Response:**
```json
{
  "code": 1,
  "success": true,
  "data": [
    {
      "Date": "2012 Jan",
      "variable1_Point Forecast": 2.5,
      "variable1_Lo 80": 2.3,
      "variable1_Hi 80": 2.7,
      "variable1_Lo 95": 2.2,
      "variable1_Hi 95": 2.8,
      ...
    }
  ]
}
```

#### Get Quarterly Forecast Results

```
GET /api/overlay/execution/mev_quarterly_arima_forecast?workflow_id={workflow_id}
```

---

### Step 4: Export Forecast Results

#### Export Monthly Forecast

```
GET /api/overlay/execution/mev_monthly_arima_forecast/export?workflow_id={workflow_id}
```

Returns the latest forecast file as Excel/CSV download.

#### Export Quarterly Forecast

```
GET /api/overlay/execution/mev_quarterly_arima_forecast/export?workflow_id={workflow_id}
```

---

## Output Format

The forecast output includes:

1. **Date Column**: Formatted as "YYYY MMM" (e.g., "2012 Jan", "2025 Sep")

2. **Forecast Columns for Each Variable**:
   - `{variable_name}_Point Forecast`: Point forecast (most likely value)
   - `{variable_name}_Lo 80`: Lower bound of 80% confidence interval
   - `{variable_name}_Hi 80`: Upper bound of 80% confidence interval
   - `{variable_name}_Lo 95`: Lower bound of 95% confidence interval
   - `{variable_name}_Hi 95`: Upper bound of 95% confidence interval

3. **Combined Data**: Historical actuals + forecasted values

**Example Output Structure:**
```
Date        | unemp_rate_Point Forecast | unemp_rate_Lo 80 | unemp_rate_Hi 80 | ... | gdp_Point Forecast | ...
2012 Jan    | 5.2                       | 5.0              | 5.4             | ... | 100.5              | ...
2012 Feb    | 5.3                       | 5.1              | 5.5             | ... | 101.2              | ...
...
2025 Sep    | 4.8                       | 4.6              | 5.0             | ... | 150.3              | ...
2025 Oct    | 4.7                       | 4.5              | 4.9             | ... | 151.0              | ... (forecasted)
```

---

## ARIMA Model Configuration

Both scripts use the same ARIMA model settings:

- **Model Selection**: Automatic (auto.arima)
- **Seasonal**: Enabled (TRUE)
- **Drift**: Disabled (FALSE)
- **Monthly Seasonality**: m=12 (for monthly forecasts)
- **Quarterly Seasonality**: m=4 (for quarterly forecasts)

The system automatically selects the best ARIMA parameters (p, d, q) and seasonal parameters (P, D, Q) for each variable.

---

## Error Handling

### Common Errors

1. **No Input File Found (404)**
   - **Cause**: No file uploaded with the correct document_type
   - **Solution**: Upload a file with document_type `OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA` or `OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA`

2. **Insufficient Data**
   - **Cause**: Not enough historical data points (need at least 12 months or 4 quarters)
   - **Solution**: Ensure your input file has sufficient historical data

3. **Invalid Parameters**
   - **Cause**: Invalid date ranges or forecast horizons
   - **Solution**: Check that start_year ≤ end_year, months/quarters are in valid ranges

4. **Forecast Processing Failed (500)**
   - **Cause**: Error during ARIMA model fitting or forecasting
   - **Solution**: Check data quality, ensure numeric values, check for missing data

---

## Complete Workflow Example

### 1. Upload Monthly MEV Data
```bash
curl -X POST "http://localhost:8000/api/document/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@MEV_Historical_Monthly_Data.xlsx" \
  -F "document_type=OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA" \
  -F "workflow_path=Entity 1/Monthly/Workflow1" \
  -F "workflow_id=1" \
  -F "module=overlay" \
  -F "submodule=execution"
```

### 2. Process Forecast
```bash
curl -X POST "http://localhost:8000/api/overlay/execution/mev_monthly_arima_forecast" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "workflow_id=1" \
  -F "start_year=2012" \
  -F "end_year=2025" \
  -F "start_month=1" \
  -F "end_month=9" \
  -F "months_to_forecast=12"
```

### 3. Get Results
```bash
curl -X GET "http://localhost:8000/api/overlay/execution/mev_monthly_arima_forecast?workflow_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Export Results
```bash
curl -X GET "http://localhost:8000/api/overlay/execution/mev_monthly_arima_forecast/export?workflow_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o forecast_results.xlsx
```

---

## Notes

1. **File Processing**: The system automatically finds the latest uploaded file in the input directory
2. **Multiple Variables**: All variables in the input file are forecasted simultaneously
3. **Confidence Intervals**: Both 80% and 95% confidence intervals are provided
4. **Historical + Forecast**: Output includes both historical actuals and forecasted values
5. **Database Storage**: Results are stored in the Document table for retrieval
6. **File Storage**: Results are saved as Excel files in the output directory

---

## Dependencies

- **pmdarima**: Recommended for automatic ARIMA model selection (install with `pip install pmdarima`)
- **statsmodels**: Fallback ARIMA implementation (usually pre-installed)
- **pandas**: Data manipulation
- **numpy**: Numerical operations

---

## Related Files

- **Python Functions**: 
  - `ecl/server/data_processing/overlay/execution/asapfi_mevs_forecast_monthly.py`
  - `ecl/server/data_processing/overlay/execution/asapfi_mevs_forecast_quarterly.py`
- **API Router**: 
  - `ecl/server/api/routers/overlay/execution/mev_arima_forecast.py`
- **R Scripts** (original):
  - `ecl/server/r_codes/arima/01 ASAPFI MEVs Forecast R Script_Monthly MEVs.R`
  - `ecl/server/r_codes/arima/02 ASAPFI MEVs Forecast R Script_Quarterly MEVs.R`

