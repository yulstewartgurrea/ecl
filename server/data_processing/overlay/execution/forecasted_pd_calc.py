import os
import warnings
import re
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

# def process_forecasted_pd_calc(finals_overlay_model_df: pd.DataFrame, 
#                                data_transformation_df: pd.DataFrame):
#     try:
#         print(finals_overlay_model_df)
#         print(data_transformation_df)
        
#         final_variable_model = format_variable_model(finals_overlay_model_df)
#         print(final_variable_model)

#         calculate_multiple_linear_regression_res = calculate_multiple_linear_regression(
#             final_variable_model, 
#             data_transformation_df)

#         print(calculate_multiple_linear_regression_res)

#         forecasted_pd_calculation_res = forecasted_pd_calculation(calculate_multiple_linear_regression_res)
#         print(forecasted_pd_calculation_res)

#         return {
#             'multiple_linear_regression': calculate_multiple_linear_regression_res,
#             'forecasted_pd': forecasted_pd_calculation_res
#         }

#     except Exception as e:
#         print(f"Error during forecasted PD calc: {str(e)}")
#         import traceback
#         traceback.print_exc()
#         return None

# def format_variable_model(finals_overlay_model_df):
#     # Get intercept value (usually 1 row only, so get from first row)
#     if finals_overlay_model_df.empty:
#         raise ValueError("finals_overlay_model_df is empty")
    
#     intercept = finals_overlay_model_df.iloc[0]['intercept']
#     print(f"Intercept value: {intercept}")
    
#     # Find all X columns (X1, X2, X3, etc.) and get their variable names and coefficients
#     x_pattern = re.compile(r'^X(\d+)$')
#     x_variables = {}  # Dictionary to store X column number -> variable name -> coefficient value
    
#     for col in finals_overlay_model_df.columns:
#         x_match = x_pattern.match(col)
#         if x_match:
#             x_num = x_match.group(1)  # Get the number (1, 2, 3, etc.)
#             x_col = f"X{x_num}"
#             coeff_col = f"coeff_X{x_num}"
            
#             # Get the variable name from X column (e.g., 'rrp_rate' from X1)
#             variable_name = finals_overlay_model_df.iloc[0][x_col]

#             print(variable_name)
            
#             # Get the coefficient value from coeff column
#             if coeff_col in finals_overlay_model_df.columns:
#                 coefficient_value = finals_overlay_model_df.iloc[0][coeff_col]
#                 x_variables[x_col] = {
#                     'variable_name': variable_name,
#                     'coefficient': coefficient_value
#                 }
#                 print(f"{x_col} = {variable_name}, coefficient = {coefficient_value}")
#             else:
#                 print(f"Warning: {coeff_col} not found in columns")
#                 x_variables[x_col] = {
#                     'variable_name': variable_name,
#                     'coefficient': None
#                 }
    
#     print(f"Found {len(x_variables)} X variables: {x_variables}")

#     # Format as dictionary with intercept and variable names as keys
#     final_format = {'intercept': intercept}
    
#     # Add each variable name with its coefficient value
#     for x_col, var_info in x_variables.items():
#         variable_name = var_info['variable_name']
#         coefficient_value = var_info['coefficient']
#         if variable_name:  # Only add if variable name exists
#             final_format[variable_name] = coefficient_value
    
#     return final_format

# def calculate_multiple_linear_regression(final_variable_model, data_transformation_df):
#     try:
#         print('final_variable_model \n', final_variable_model)
#         print('data_transformation_df \n', data_transformation_df)
#         print('independent_data_transformation \n', independent_data_transformation)

#         independent_data_transformation['time'] = pd.to_datetime(
#             independent_data_transformation['time'],
#             infer_datetime_format=True
#         )
#         actual_max_time = independent_data_transformation['time'].max()
#         actual_odr_value = independent_data_transformation[independent_data_transformation['time'] == actual_max_time]['odr'].values[0]
#         print('actual_odr_value', actual_odr_value)
#         print('actual_max_time', actual_max_time)

        
#         # Get intercept
#         intercept = final_variable_model['intercept']
        
#         # Get variable names (excluding intercept)
#         variables = {k: v for k, v in final_variable_model.items() if k != 'intercept'}
        
#         # Create result DataFrame with Period
#         result_df = pd.DataFrame()
#         result_df['Period'] = data_transformation_df['Period'].copy()
        
#         # Scenarios to calculate
#         scenarios = ['Upside', 'Base', 'Downside']
        
#         # Calculate for each scenario
#         for scenario in scenarios:
#             scenario_values = []
            
#             for idx, row in data_transformation_df.iterrows():
#                 # Calculate: intercept + sum(coefficient * value) for each variable
#                 calculation = intercept
                
#                 for variable_name, coefficient in variables.items():
#                     # Find the corresponding column in data_transformation_df
#                     # Format: "{scenario} {variable_name}" (e.g., "Upside rrp_rate")
#                     column_name = f"{scenario} {variable_name}"
                    
#                     if column_name in data_transformation_df.columns:
#                         # Get the value and convert to numeric (handle percentage strings)
#                         value = row[column_name]
#                         if isinstance(value, str):
#                             # Remove % sign and convert
#                             value = value.replace('%', '')
#                         value = pd.to_numeric(value, errors='coerce')
                        
#                         # Add coefficient * value to calculation
#                         if pd.notna(value) and pd.notna(coefficient):
#                             calculation += coefficient * value
#                     else:
#                         print(f"Warning: Column '{column_name}' not found in data_transformation_df")
                
#                 scenario_values.append(calculation)
            
#             # Add scenario column to result
#             result_df[f'{scenario}'] = scenario_values
        
#         print(f"Calculated multiple linear regression for {len(result_df)} periods")
#         return result_df
        
#     except Exception as e:
#         print(f"Error during multiple linear regression: {str(e)}")
#         import traceback
#         traceback.print_exc()
#         return None

# def forecasted_pd_calculation(multiple_linear_regression):
#     try:
#         result_df = pd.DataFrame()
#         result_df['Period'] = multiple_linear_regression['Period'].copy()

#         # Scenarios to calculate
#         scenarios = ['Upside', 'Base', 'Downside']

#         # Apply logistic function: EXP(x) / (1 + EXP(x)) for each scenario
#         for scenario in scenarios:
#             # Get the values from multiple_linear_regression for this scenario
#             regression_values = multiple_linear_regression[scenario].copy()
            
#             # Apply logistic function: EXP(x) / (1 + EXP(x))
#             # This is the inverse logit function
#             exp_values = np.exp(regression_values)
#             pd_values = exp_values / (1 + exp_values)
            
#             # Store the calculated PD values
#             result_df[scenario] = pd_values

#         print(f"Calculated forecasted PD for {len(result_df)} periods")
#         return result_df
        
#     except Exception as e:
#         print(f"Error during forecasted PD calculation: {str(e)}")
#         import traceback
#         traceback.print_exc()
#         return None

def process_forecasted_pd_calc(finals_overlay_model_df: pd.DataFrame, 
                               data_transformation_df: pd.DataFrame,
                               independent_data_transformation_df: pd.DataFrame):
    try:
        print(finals_overlay_model_df)
        print(data_transformation_df)
        print(independent_data_transformation_df)
        
        calculate_multiple_linear_regression_res = create_multiple_linear_regression_table(
            finals_overlay_model_df, 
            data_transformation_df)

        print('calculate_multiple_linear_regression_res \n', calculate_multiple_linear_regression_res)

        forecasted_pd_calculation_res = create_forecasted_clrs_table(calculate_multiple_linear_regression_res)
        print(forecasted_pd_calculation_res)

        return {
            'multiple_linear_regression': calculate_multiple_linear_regression_res,
            'forecasted_pd': forecasted_pd_calculation_res
        }

    except Exception as e:
        print(f"Error during forecasted PD calc: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def create_multiple_linear_regression_table(finals_overlay_model_df: pd.DataFrame,
                                            data_transformation_df: pd.DataFrame):
    """
    Create Multiple Linear Regression table based on Excel formulas from overlay.csv.
    
    Excel Formula Analysis (Line 18):
    =SUMPRODUCT(TRANSPOSE($D$14:$D$16),$AA35:$AC35)+$D$13
    
    Breakdown:
    - $D$13 = Intercept (fixed reference)
    - $D$14:$D$16 = Coefficients array (3 coefficients)
    - $AA35:$AC35 = Variable values for Upside scenario (row 35, columns AA-AC)
    - TRANSPOSE($D$14:$D$16) = Transpose coefficients to row vector
    - SUMPRODUCT = Dot product (sum of element-wise multiplication)
    
    Formula translates to: intercept + (coeff1*var1 + coeff2*var2 + coeff3*var3)
    
    Table Structure (matching CSV lines 16-29):
    - Period | Upside | Base | Downside
    - 12 periods (rows 18-29 in Excel)
    
    Args:
        finals_overlay_model_df: DataFrame with model coefficients
                                 Expected: intercept, X1, X2, X3, ..., coeff_X1, coeff_X2, coeff_X3, ...
        data_transformation_df: DataFrame with Period and scenario variable columns
                                Expected: Period, "Upside {var}", "Base {var}", "Downside {var}"
    
    Returns:
        DataFrame with columns: Period, Upside, Base, Downside
    """
    try:
        # Extract intercept (equivalent to $D$13)
        if finals_overlay_model_df.empty:
            raise ValueError("finals_overlay_model_df is empty")
        
        intercept = finals_overlay_model_df.iloc[0]['intercept']
        print(f"Intercept ($D$13): {intercept}")
        
        # Extract coefficients (equivalent to $D$14:$D$16)
        # Look for X1, X2, X3, etc. and get their coeff_X1, coeff_X2, coeff_X3 values
        coefficients = []
        variable_names = []
        
        x_pattern = re.compile(r'^X(\d+)$', re.IGNORECASE)
        print(f"All columns: {finals_overlay_model_df.columns.tolist()}")
        for col in sorted(finals_overlay_model_df.columns, key=lambda x: (not x_pattern.match(x), x)):
            x_match = x_pattern.match(col)
            if x_match:
                x_num = x_match.group(1)
                print(f"Found X column: {col}, number: {x_num}")
                
                # Try both uppercase and lowercase coefficient column names
                coeff_col_upper = f"coeff_X{x_num}"
                coeff_col_lower = f"coeff_x{x_num}"
                
                # Get variable name from X column (e.g., 'rrp_rate' from X1)
                # If variable name is not in the column, use the column name itself as fallback
                variable_name = finals_overlay_model_df.iloc[0][col]
                if pd.isna(variable_name) or variable_name == '':
                    # Use column name as fallback (e.g., 'x1' -> use 'x1' as variable name)
                    variable_name = col
                    print(f"Variable name from {col} is empty/NaN, using column name '{col}' as fallback")
                
                # Get coefficient value (equivalent to values in $D$14:$D$16)
                # Check both uppercase and lowercase versions
                coeff_col = None
                if coeff_col_upper in finals_overlay_model_df.columns:
                    coeff_col = coeff_col_upper
                    print(f"Found coefficient column (uppercase): {coeff_col}")
                elif coeff_col_lower in finals_overlay_model_df.columns:
                    coeff_col = coeff_col_lower
                    print(f"Found coefficient column (lowercase): {coeff_col}")
                else:
                    print(f"Warning: Neither {coeff_col_upper} nor {coeff_col_lower} found in columns")
                
                if coeff_col:
                    coeff_value = finals_overlay_model_df.iloc[0][coeff_col]
                    print(f"Raw coefficient value from {coeff_col}: {coeff_value} (type: {type(coeff_value)})")
                    
                    if pd.notna(coeff_value):
                        coefficients.append(float(coeff_value))
                        variable_names.append(str(variable_name))
                        print(f"Coefficient {len(coefficients)}: {variable_name} = {coeff_value}")
                    else:
                        print(f"Warning: Coefficient value from {coeff_col} is NaN")
                else:
                    print(f"Warning: Neither {coeff_col_upper} nor {coeff_col_lower} found in columns")
        
        if len(coefficients) == 0:
            raise ValueError("No valid coefficients found")
        
        coefficients_array = np.array(coefficients)
        print(f"Total coefficients ($D$14:$D$16): {coefficients_array}")
        
        # Create result DataFrame with Period column
        result_df = pd.DataFrame()
        result_df['Period'] = data_transformation_df['Period'].copy()
        
        # Scenarios matching CSV: Upside, Base, Downside
        # Note: CSV uses "Base" but data might have "Base"
        scenarios_config = [
            {'output': 'Upside', 'data': 'Upside'},      # Columns AA-AC in Excel
            {'output': 'Base', 'data': 'Base'},      # Columns AD-AF in Excel (mapped from "Base")
            {'output': 'Downside', 'data': 'Downside'}  # Columns AG-AI in Excel
        ]
        
        # Calculate for each scenario
        for scenario in scenarios_config:
            scenario_output = scenario['output']
            scenario_data = scenario['data']
            scenario_values = []
            
            # For each period (row) in data_transformation_df
            for idx, row in data_transformation_df.iterrows():
                # Build variable values array for this period (equivalent to $AA35:$AC35, etc.)
                variable_values = []
                
                for var_name in variable_names:
                    # Handle variable names that might have suffixes (e.g., "gdp.1" -> use "gdp")
                    base_var_name = var_name.split('.')[0] if '.' in var_name else var_name
                    
                    # Construct column name: "{scenario} {variable_name}"
                    # This matches Excel columns like AA35 (Upside), AD35 (Base), AG35 (Downside)
                    column_name = f"{scenario_data} {base_var_name}"
                    
                    if column_name in data_transformation_df.columns:
                        value = row[column_name]
                        
                        # Handle string values (e.g., percentages with % sign)
                        if isinstance(value, str):
                            value = value.replace('%', '').strip()
                        
                        value = pd.to_numeric(value, errors='coerce')
                        
                        if pd.notna(value):
                            variable_values.append(float(value))
                        else:
                            variable_values.append(0.0)
                            print(f"Warning: NaN for {column_name} at row {idx}, using 0")
                    else:
                        variable_values.append(0.0)
                        print(f"Warning: Column '{column_name}' not found, using 0")
                
                variable_values_array = np.array(variable_values)
                
                # Calculate: intercept + SUMPRODUCT(TRANSPOSE(coefficients), variable_values)
                # SUMPRODUCT with TRANSPOSE is equivalent to dot product
                # Formula: $D$13 + SUMPRODUCT(TRANSPOSE($D$14:$D$16), $AA35:$AC35)
                regression_value = intercept + np.dot(coefficients_array, variable_values_array)
                
                scenario_values.append(regression_value)
            
            # Add scenario column to result (using CSV output name: Base)
            result_df[scenario_output] = scenario_values
        
        # Ensure Period column is preserved (first column)
        if 'Period' in result_df.columns:
            # Reorder columns to put Period first
            cols = ['Period'] + [col for col in result_df.columns if col != 'Period']
            result_df = result_df[cols]
        
        print(f"Created Multiple Linear Regression table: {len(result_df)} periods")
        print(f"Columns in result: {result_df.columns.tolist()}")
        return result_df
        
    except Exception as e:
        print(f"Error creating Multiple Linear Regression table: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def create_forecasted_clrs_table(multiple_linear_regression_df: pd.DataFrame):
    """
    Create Forecasted CLRs table by applying logistic function to Multiple Linear Regression values.
    
    Excel Formula Analysis (Line 33):
    =EXP(B18:D29)/(EXP(B18:D29) + 1)
    
    Breakdown:
    - B18:D29 = Range from Multiple Linear Regression table (all scenarios, all periods)
    - EXP(B18:D29) = Exponential of each value
    - EXP(B18:D29) + 1 = Add 1 to each exponential
    - Division = Element-wise division (logistic/sigmoid function)
    
    This converts log-odds (from regression) to probabilities (0 to 1 range).
    
    Table Structure (matching CSV lines 31-44):
    - Period | Upside | Base | Downside
    - Period column references: =A18# (spills from Multiple Linear Regression Period column)
    - 12 periods (same as Multiple Linear Regression table)
    
    Args:
        multiple_linear_regression_df: DataFrame from create_multiple_linear_regression_table()
                                     Expected columns: Period, Upside, Base, Downside
    
    Returns:
        DataFrame with columns: Period, Upside, Base, Downside (CLR values as probabilities)
    """
    try:
        if multiple_linear_regression_df.empty:
            raise ValueError("multiple_linear_regression_df is empty")
        
        # Create result DataFrame
        result_df = pd.DataFrame()
        
        # Period column: Reference from Multiple Linear Regression table (=A18# in Excel)
        result_df['Period'] = multiple_linear_regression_df['Period'].copy()
        
        # Scenarios matching CSV: Upside, Base, Downside
        scenarios = ['Upside', 'Base', 'Downside']
        
        # Apply logistic function to each scenario
        for scenario in scenarios:
            if scenario not in multiple_linear_regression_df.columns:
                print(f"Warning: Scenario '{scenario}' not found in input DataFrame")
                continue
            
            # Get regression values (equivalent to B18:D29 range in Excel)
            regression_values = multiple_linear_regression_df[scenario].copy()
            
            # Apply logistic function: EXP(x) / (EXP(x) + 1)
            # This matches Excel formula: =EXP(B18:D29)/(EXP(B18:D29) + 1)
            exp_values = np.exp(regression_values)
            clr_values = exp_values / (exp_values + 1)
            
            # Store CLR values (probabilities between 0 and 1)
            result_df[scenario] = clr_values
        
        # Ensure Period column is preserved (first column)
        if 'Period' in result_df.columns:
            # Reorder columns to put Period first
            cols = ['Period'] + [col for col in result_df.columns if col != 'Period']
            result_df = result_df[cols]
        
        print(f"Created Forecasted CLRs table: {len(result_df)} periods")
        print(f"Columns in result: {result_df.columns.tolist()}")
        return result_df
        
    except Exception as e:
        print(f"Error creating Forecasted CLRs table: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def calculate_overlay_multipliers(forecasted_clrs_df: pd.DataFrame,
                                  normalization_factor: float = None,
                                  independent_data_transformation_df: pd.DataFrame = None):
    """
    Calculate Overlay Multipliers based on Excel formulas from overlay.csv.
    
    Excel Formula Analysis (Lines 46-49):
    Forward-looking CLR section:
    - Upside:    =TRANSPOSE(B44:D44) then =B47/$C$64
    - Base:  =TRANSPOSE(B44:D44) then =B48/$C$64
    - Downside:  =TRANSPOSE(B44:D44) then =B49/$C$64
    
    Breakdown:
    - B44:D44 = Last row of Forecasted CLRs table (last period's CLR values)
    - TRANSPOSE(B44:D44) = Gets the last period CLR values for each scenario
    - $C$64 = Normalization factor (likely average default rate or latest ODR)
    - Division = Each Forward-looking CLR divided by normalization factor
    
    Formula: Overlay Multiplier = Forward-looking CLR / Normalization Factor
    
    Args:
        forecasted_clrs_df: DataFrame from create_forecasted_clrs_table()
                           Expected columns: Period, Upside, Base, Downside
        normalization_factor: Value to normalize by (equivalent to $C$64 in Excel)
                             If None, will use latest ODR from independent_data_transformation_df
        independent_data_transformation_df: DataFrame with historical default rates
                                           Expected columns: time, odr
                                           Used to get latest ODR if normalization_factor not provided
    
    Returns:
        Dictionary with:
        - 'forward_looking_clr': Dictionary with last period CLR values for each scenario
        - 'overlay_multipliers': Dictionary with calculated multipliers for each scenario
        - 'normalization_factor': The normalization factor used
    """
    try:
        if forecasted_clrs_df.empty:
            raise ValueError("forecasted_clrs_df is empty")
        
        # Get last row of Forecasted CLRs (equivalent to B44:D44 in Excel)
        # This is the Forward-looking CLR for each scenario
        last_row = forecasted_clrs_df.iloc[-1]
        
        scenarios = ['Upside', 'Base', 'Downside']
        forward_looking_clr = {}
        
        # Extract Forward-looking CLR values (TRANSPOSE(B44:D44))
        for scenario in scenarios:
            if scenario in last_row.index:
                clr_value = last_row[scenario]
                if pd.notna(clr_value):
                    forward_looking_clr[scenario] = float(clr_value)
                    print(f"Forward-looking CLR ({scenario}): {clr_value}")
                else:
                    print(f"Warning: NaN value for {scenario} in last row")
            else:
                print(f"Warning: Scenario '{scenario}' not found in forecasted_clrs_df")
        
        # Determine normalization factor ($C$64 equivalent)
        # $M$18 in Excel (line 54) represents the actual ODR value for the latest period
        if normalization_factor is None:
            if independent_data_transformation_df is not None and not independent_data_transformation_df.empty:
                # Get latest ODR (Observed Default Rate) as normalization factor
                # This is equivalent to $M$18 in Excel - the actual ODR for the latest period
                if 'time' in independent_data_transformation_df.columns and 'odr' in independent_data_transformation_df.columns:
                    # Use the exact pattern to get $M$18 (actual ODR value)
                    independent_data_transformation_df['time'] = pd.to_datetime(
                        independent_data_transformation_df['time'],
                        infer_datetime_format=True
                    )
                    actual_max_time = independent_data_transformation_df['time'].max()
                    actual_odr_value = independent_data_transformation_df[
                        independent_data_transformation_df['time'] == actual_max_time
                    ]['odr'].values[0]
                    
                    print(f'actual_odr_value ($M$18): {actual_odr_value}')
                    print(f'actual_max_time: {actual_max_time}')
                    
                    # Convert to numeric (handle percentage strings)
                    if isinstance(actual_odr_value, str):
                        actual_odr_value = actual_odr_value.replace('%', '').strip()
                        actual_odr_value = pd.to_numeric(actual_odr_value, errors='coerce')
                        # If it was a percentage string, convert to decimal
                        if pd.notna(actual_odr_value) and actual_odr_value > 1.0:
                            actual_odr_value = actual_odr_value / 100.0
                    else:
                        actual_odr_value = pd.to_numeric(actual_odr_value, errors='coerce')
                        # If numeric and > 1, assume percentage and convert to decimal
                        if pd.notna(actual_odr_value) and actual_odr_value > 1.0:
                            actual_odr_value = actual_odr_value / 100.0
                    
                    normalization_factor = float(actual_odr_value) if pd.notna(actual_odr_value) else None
                    print(f"Using actual ODR ($M$18) as normalization factor: {normalization_factor}")
                else:
                    print("Warning: 'time' or 'odr' columns not found, using default normalization factor")
                    normalization_factor = 1.0
            else:
                print("Warning: No normalization factor provided and no independent_data_transformation_df, using default")
                normalization_factor = 1.0
        
        if normalization_factor is None or normalization_factor == 0:
            raise ValueError("Normalization factor cannot be None or zero")
        
        print(f"Normalization factor ($C$64): {normalization_factor}")
        
        # Calculate Overlay Multipliers: Forward-looking CLR / Normalization Factor
        # Formula: =B47/$C$64, =B48/$C$64, =B49/$C$64
        overlay_multipliers = {}
        for scenario in scenarios:
            if scenario in forward_looking_clr:
                clr_value = forward_looking_clr[scenario]
                multiplier = clr_value / normalization_factor
                overlay_multipliers[scenario] = float(multiplier)
                print(f"Overlay Multiplier ({scenario}): {multiplier}")
            else:
                print(f"Warning: No Forward-looking CLR for {scenario}, skipping multiplier calculation")
        
        result = {
            'forward_looking_clr': forward_looking_clr,
            'overlay_multipliers': overlay_multipliers,
            'normalization_factor': float(normalization_factor)
        }
        
        print(f"Calculated overlay multipliers for {len(overlay_multipliers)} scenarios")
        return result
        
    except Exception as e:
        print(f"Error calculating overlay multipliers: {str(e)}")
        import traceback
        traceback.print_exc()
        return None