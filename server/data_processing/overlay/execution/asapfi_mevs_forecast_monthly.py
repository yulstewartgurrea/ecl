import os
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from datetime import datetime

try:
    from pmdarima import auto_arima
    PMDARIMA_AVAILABLE = True
except ImportError:
    PMDARIMA_AVAILABLE = False
    print("Warning: pmdarima not available. Install with: pip install pmdarima")

from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX


def forecast_mevs_monthly(
    input_file_path: str = "Input/MEV Historical Monthly Data.xlsx",
    output_file_path: str = "Output/ASAPFI Forecasts Monthly MEVs.xlsx",
    start_year: int = 2012,
    end_year: int = 2025,
    start_month: int = 1,
    end_month: int = 9,
    months_to_forecast: int = 12
):
    """
    Forecast Monthly MEVs using ARIMA models.
    
    This function replicates the functionality of the R script:
    "01 ASAPFI MEVs Forecast R Script_Monthly MEVs.R"
    
    Args:
        input_file_path: Path to the input Excel file with historical monthly MEV data
        output_file_path: Path to save the forecasted results
        start_year: Start year for the time series
        end_year: End year for the historical data
        start_month: Start month (1-12)
        end_month: End month (1-12) for historical data
        months_to_forecast: Number of months to forecast ahead
    
    Returns:
        DataFrame with consolidated forecasts
    """
    try:
        print("="*60)
        print("ASAPFI MONTHLY MEVs FORECAST")
        print("="*60)
        
        # Step 1: Read historical monthly data
        print(f"\nStep 1: Reading historical monthly data from {input_file_path}...")
        
        if not os.path.exists(input_file_path):
            raise FileNotFoundError(f"Input file not found: {input_file_path}")
        
        # Determine file type and read accordingly
        file_ext = os.path.splitext(input_file_path)[1].lower()
        if file_ext in ['.xlsx', '.xls']:
            print(f"Detected Excel file: {file_ext}")
            independent = pd.read_excel(input_file_path)
        elif file_ext == '.csv':
            print(f"Detected CSV file")
            independent = pd.read_csv(input_file_path, encoding='utf-8-sig')
        else:
            raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls")
        
        # Remove first 3 rows (headers/metadata rows)
        # Row 1: Column names, Row 2: Descriptions, Row 3: Units
        independent = independent.iloc[3:].reset_index(drop=True)
        
        # Clean percentage signs and convert to numeric
        for col in independent.columns:
            if independent[col].dtype == 'object':
                # Remove % signs and convert to numeric
                independent[col] = independent[col].astype(str).str.replace('%', '', regex=False)
                independent[col] = pd.to_numeric(independent[col], errors='coerce')
            else:
                independent[col] = pd.to_numeric(independent[col], errors='coerce')
        
        print(f"Read {len(independent)} rows and {len(independent.columns)} columns")
        
        # Step 2: Filter out metadata columns and get variable names
        # Metadata columns that shouldn't be forecasted
        metadata_columns = ['year', 'month (int)', 'month', 'id', 'quarter', 'x']
        variables = [col for col in independent.columns if col.lower() not in [m.lower() for m in metadata_columns]]
        
        print(f"\nStep 2: Found {len(variables)} variables to forecast (excluding {len(independent.columns) - len(variables)} metadata columns)")
        
        # Step 3: Forecast each variable
        print(f"\nStep 3: Forecasting {months_to_forecast} months ahead for each variable...")
        
        forecast_results = []
        
        for var_idx, var_name in enumerate(variables, 1):
            print(f"   [{var_idx}/{len(variables)}] Forecasting: {var_name}")
            
            try:
                # Get data for this variable
                data = independent[var_name].dropna().values
                
                # Check if column has sufficient valid data (at least 12 non-null values)
                if len(data) < 12:
                    print(f"      Warning: Insufficient valid data for {var_name} ({len(data)} values, need at least 12), skipping...")
                    continue
                
                # Create time series object
                # R: ts(start = c(start_year, start_month), end = c(end_year, end_month), freq = 12)
                start_date = pd.Timestamp(year=start_year, month=start_month, day=1)
                end_date = pd.Timestamp(year=end_year, month=end_month, day=1)
                
                # Create date range for historical data
                date_range = pd.date_range(start=start_date, end=end_date, freq='MS')  # Month Start
                
                # Align data with date range (handle length mismatch)
                if len(data) > len(date_range):
                    data = data[:len(date_range)]
                elif len(data) < len(date_range):
                    # Pad with NaN if needed
                    padded_data = np.full(len(date_range), np.nan)
                    padded_data[:len(data)] = data
                    data = padded_data
                
                # Create time series
                data_ts = pd.Series(data, index=date_range)
                data_ts = data_ts.dropna()
                
                if len(data_ts) < 12:  # Need at least 12 months for seasonal ARIMA
                    print(f"      Warning: Insufficient data for {var_name} (need at least 12 months), skipping...")
                    continue
                
                # Fit ARIMA model
                # R: auto.arima(data.ts, allowdrift = FALSE, seasonal = TRUE)
                try:
                    if PMDARIMA_AVAILABLE:
                        # Use pmdarima for automatic ARIMA selection (similar to R's auto.arima)
                        fit = auto_arima(
                            data_ts,
                            seasonal=True,
                            m=12,  # Monthly seasonality
                            allowdrift=False,
                            suppress_warnings=True,
                            error_action='ignore',
                            stepwise=True
                        )
                        model = fit
                    else:
                        # Fallback: Use simple ARIMA(1,1,1) with seasonal component
                        print("      Using fallback ARIMA model (install pmdarima for auto selection)")
                        model = SARIMAX(
                            data_ts,
                            order=(1, 1, 1),
                            seasonal_order=(1, 1, 1, 12),
                            enforce_stationarity=False,
                            enforce_invertibility=False
                        ).fit(disp=False)
                except Exception as model_error:
                    print(f"      Error fitting ARIMA model for {var_name}: {str(model_error)}")
                    print(f"      Skipping {var_name}...")
                    continue
                
                # Forecast
                # R: forecast(fit, h=month_to_forecast)
                # Try to get confidence intervals from the model
                try:
                    if PMDARIMA_AVAILABLE and hasattr(model, 'predict'):
                        # pmdarima's predict can return confidence intervals
                        forecast_result, conf_int = model.predict(
                            n_periods=months_to_forecast,
                            return_conf_int=True,
                            alpha=0.2  # 80% confidence interval
                        )
                        # Get 95% confidence interval as well
                        _, conf_int_95 = model.predict(
                            n_periods=months_to_forecast,
                            return_conf_int=True,
                            alpha=0.05  # 95% confidence interval
                        )
                        # Convert to Series if needed
                        if not isinstance(forecast_result, pd.Series):
                            forecast_result = pd.Series(forecast_result)
                        lower_80 = pd.Series(conf_int[:, 0], index=forecast_result.index if hasattr(forecast_result, 'index') else range(len(conf_int)))
                        upper_80 = pd.Series(conf_int[:, 1], index=forecast_result.index if hasattr(forecast_result, 'index') else range(len(conf_int)))
                        lower_95 = pd.Series(conf_int_95[:, 0], index=forecast_result.index if hasattr(forecast_result, 'index') else range(len(conf_int_95)))
                        upper_95 = pd.Series(conf_int_95[:, 1], index=forecast_result.index if hasattr(forecast_result, 'index') else range(len(conf_int_95)))
                    else:
                        # Fallback: use model's get_forecast if available (statsmodels)
                        forecast_result = model.predict(n_periods=months_to_forecast)
                        if hasattr(model, 'get_forecast'):
                            forecast_obj = model.get_forecast(steps=months_to_forecast)
                            forecast_result = forecast_obj.predicted_mean
                            conf_int = forecast_obj.conf_int(alpha=0.2)  # 80% CI
                            conf_int_95 = forecast_obj.conf_int(alpha=0.05)  # 95% CI
                            lower_80 = conf_int.iloc[:, 0]
                            upper_80 = conf_int.iloc[:, 1]
                            lower_95 = conf_int_95.iloc[:, 0]
                            upper_95 = conf_int_95.iloc[:, 1]
                        else:
                            # Approximate confidence intervals using standard deviation
                            forecast_std = np.std(data_ts.values) if len(data_ts) > 0 else 1.0
                            forecast_result = pd.Series(forecast_result) if not isinstance(forecast_result, pd.Series) else forecast_result
                            lower_80 = forecast_result - 1.28 * forecast_std
                            upper_80 = forecast_result + 1.28 * forecast_std
                            lower_95 = forecast_result - 1.96 * forecast_std
                            upper_95 = forecast_result + 1.96 * forecast_std
                except Exception as e:
                    # Fallback: simple prediction with approximate intervals
                    forecast_result = model.predict(n_periods=months_to_forecast)
                    forecast_result = pd.Series(forecast_result) if not isinstance(forecast_result, pd.Series) else forecast_result
                    forecast_std = np.std(data_ts.values) if len(data_ts) > 0 else 1.0
                    lower_80 = forecast_result - 1.28 * forecast_std
                    upper_80 = forecast_result + 1.28 * forecast_std
                    lower_95 = forecast_result - 1.96 * forecast_std
                    upper_95 = forecast_result + 1.96 * forecast_std
                
                # Create forecast dates
                last_date = data_ts.index[-1]
                forecast_dates = pd.date_range(
                    start=last_date + pd.DateOffset(months=1),
                    periods=months_to_forecast,
                    freq='MS'
                )
                
                # Create forecast DataFrame (similar to R's forecast output)
                # Ensure all are Series/arrays with same length
                forecast_values = forecast_result.values if hasattr(forecast_result, 'values') else np.array(forecast_result)
                lower_80_values = lower_80.values if hasattr(lower_80, 'values') else np.array(lower_80)
                upper_80_values = upper_80.values if hasattr(upper_80, 'values') else np.array(upper_80)
                lower_95_values = lower_95.values if hasattr(lower_95, 'values') else np.array(lower_95)
                upper_95_values = upper_95.values if hasattr(upper_95, 'values') else np.array(upper_95)
                
                forecast_df = pd.DataFrame({
                    'Point Forecast': forecast_values,
                    'Lo 80': lower_80_values,
                    'Hi 80': upper_80_values,
                    'Lo 95': lower_95_values,
                    'Hi 95': upper_95_values
                }, index=forecast_dates)
                
                # Create actual data DataFrame (replicate 5 times as in R script)
                # R: replicate(5,as.data.frame(data.ts)$x) %>% as.data.frame()
                actual_df = pd.DataFrame({
                    'Point Forecast': data_ts.values,
                    'Lo 80': data_ts.values,
                    'Hi 80': data_ts.values,
                    'Lo 95': data_ts.values,
                    'Hi 95': data_ts.values
                }, index=data_ts.index)
                
                # Rename columns with variable prefix
                # R: colnames(forecast) <- paste0(x,"_",cnames)
                cnames = forecast_df.columns.tolist()
                forecast_df.columns = [f"{var_name}_{col}" for col in cnames]
                actual_df.columns = [f"{var_name}_{col}" for col in cnames]
                
                # Combine actual and forecast
                # R: alldat = rbind(actual,forecast)
                combined_df = pd.concat([actual_df, forecast_df])
                
                forecast_results.append(combined_df)
                
            except Exception as e:
                print(f"      Error forecasting {var_name}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
        
        if len(forecast_results) == 0:
            raise ValueError("No successful forecasts generated")
        
        # Step 4: Consolidate all forecasts
        print(f"\nStep 4: Consolidating forecasts...")
        
        # R: Consolidated_forecast = do.call("cbind", Forecast_variables)
        consolidated_forecast = pd.concat(forecast_results, axis=1)
        
        # Add Date column
        # R: Consolidated_forecast$Date <- rownames(Consolidated_forecast)
        # R uses as.yearmon() which formats as "YYYY MMM", we'll use similar format
        consolidated_forecast['Date'] = consolidated_forecast.index.strftime('%Y %b')
        
        # Reorder columns to put Date first
        # R: Consolidated_forecast = Consolidated_forecast |> dplyr::select("Date", everything())
        cols = ['Date'] + [col for col in consolidated_forecast.columns if col != 'Date']
        consolidated_forecast = consolidated_forecast[cols]
        
        # Step 5: Save to Excel (if output path provided)
        if output_file_path:
            print(f"\nStep 5: Saving results to {output_file_path}...")
            
            # Create output directory if it doesn't exist
            output_dir = os.path.dirname(output_file_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            consolidated_forecast.to_excel(output_file_path, index=False)
            print(f"Results saved to {output_file_path}")
        else:
            print(f"\nStep 5: No output file path provided, skipping file save")
        
        print(f"\nForecast complete! Results saved to {output_file_path}")
        print(f"Total variables forecasted: {len(forecast_results)}")
        print(f"Total periods: {len(consolidated_forecast)} (historical + forecast)")
        
        return consolidated_forecast
        
    except Exception as e:
        print(f"Error during monthly MEVs forecast: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    # Example usage
    result = forecast_mevs_monthly(
        input_file_path="Input/MEV Historical Monthly Data.xlsx",
        output_file_path="Output/ASAPFI Forecasts Monthly MEVs.xlsx",
        start_year=2012,
        end_year=2025,
        start_month=1,
        end_month=9,
        months_to_forecast=12
    )

