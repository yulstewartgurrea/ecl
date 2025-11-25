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

def process_forecasted_pd_calc(finals_overlay_model_df: pd.DataFrame, 
                               data_transformation_df: pd.DataFrame):
    try:
        print(finals_overlay_model_df)
        print(data_transformation_df)
        
        final_variable_model = format_variable_model(finals_overlay_model_df)
        print(final_variable_model)

        calculate_multiple_linear_regression_res = calculate_multiple_linear_regression(
            final_variable_model, 
            data_transformation_df)

        print(calculate_multiple_linear_regression_res)

        forecasted_pd_calculation_res = forecasted_pd_calculation(calculate_multiple_linear_regression_res)
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

def format_variable_model(finals_overlay_model_df):
    # Get intercept value (usually 1 row only, so get from first row)
    if finals_overlay_model_df.empty:
        raise ValueError("finals_overlay_model_df is empty")
    
    intercept = finals_overlay_model_df.iloc[0]['intercept']
    print(f"Intercept value: {intercept}")
    
    # Find all X columns (X1, X2, X3, etc.) and get their variable names and coefficients
    x_pattern = re.compile(r'^X(\d+)$')
    x_variables = {}  # Dictionary to store X column number -> variable name -> coefficient value
    
    for col in finals_overlay_model_df.columns:
        x_match = x_pattern.match(col)
        if x_match:
            x_num = x_match.group(1)  # Get the number (1, 2, 3, etc.)
            x_col = f"X{x_num}"
            coeff_col = f"coeff_X{x_num}"
            
            # Get the variable name from X column (e.g., 'rrp_rate' from X1)
            variable_name = finals_overlay_model_df.iloc[0][x_col]
            
            # Get the coefficient value from coeff column
            if coeff_col in finals_overlay_model_df.columns:
                coefficient_value = finals_overlay_model_df.iloc[0][coeff_col]
                x_variables[x_col] = {
                    'variable_name': variable_name,
                    'coefficient': coefficient_value
                }
                print(f"{x_col} = {variable_name}, coefficient = {coefficient_value}")
            else:
                print(f"Warning: {coeff_col} not found in columns")
                x_variables[x_col] = {
                    'variable_name': variable_name,
                    'coefficient': None
                }
    
    print(f"Found {len(x_variables)} X variables: {x_variables}")

    # Format as dictionary with intercept and variable names as keys
    final_format = {'intercept': intercept}
    
    # Add each variable name with its coefficient value
    for x_col, var_info in x_variables.items():
        variable_name = var_info['variable_name']
        coefficient_value = var_info['coefficient']
        if variable_name:  # Only add if variable name exists
            final_format[variable_name] = coefficient_value
    
    return final_format

def calculate_multiple_linear_regression(final_variable_model, data_transformation_df):
    try:
        print(final_variable_model)
        print(data_transformation_df)
        
        # Get intercept
        intercept = final_variable_model['intercept']
        
        # Get variable names (excluding intercept)
        variables = {k: v for k, v in final_variable_model.items() if k != 'intercept'}
        
        # Create result DataFrame with Period
        result_df = pd.DataFrame()
        result_df['Period'] = data_transformation_df['Period'].copy()
        
        # Scenarios to calculate
        scenarios = ['Best', 'Base', 'Worst']
        
        # Calculate for each scenario
        for scenario in scenarios:
            scenario_values = []
            
            for idx, row in data_transformation_df.iterrows():
                # Calculate: intercept + sum(coefficient * value) for each variable
                calculation = intercept
                
                for variable_name, coefficient in variables.items():
                    # Find the corresponding column in data_transformation_df
                    # Format: "{scenario} {variable_name}" (e.g., "Best rrp_rate")
                    column_name = f"{scenario} {variable_name}"
                    
                    if column_name in data_transformation_df.columns:
                        # Get the value and convert to numeric (handle percentage strings)
                        value = row[column_name]
                        if isinstance(value, str):
                            # Remove % sign and convert
                            value = value.replace('%', '')
                        value = pd.to_numeric(value, errors='coerce')
                        
                        # Add coefficient * value to calculation
                        if pd.notna(value) and pd.notna(coefficient):
                            calculation += coefficient * value
                    else:
                        print(f"Warning: Column '{column_name}' not found in data_transformation_df")
                
                scenario_values.append(calculation)
            
            # Add scenario column to result
            result_df[f'{scenario}'] = scenario_values
        
        print(f"Calculated multiple linear regression for {len(result_df)} periods")
        return result_df
        
    except Exception as e:
        print(f"Error during multiple linear regression: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def forecasted_pd_calculation(multiple_linear_regression):
    try:
        result_df = pd.DataFrame()
        result_df['Period'] = multiple_linear_regression['Period'].copy()

        # Scenarios to calculate
        scenarios = ['Best', 'Base', 'Worst']

        # Apply logistic function: EXP(x) / (1 + EXP(x)) for each scenario
        for scenario in scenarios:
            # Get the values from multiple_linear_regression for this scenario
            regression_values = multiple_linear_regression[scenario].copy()
            
            # Apply logistic function: EXP(x) / (1 + EXP(x))
            # This is the inverse logit function
            exp_values = np.exp(regression_values)
            pd_values = exp_values / (1 + exp_values)
            
            # Store the calculated PD values
            result_df[scenario] = pd_values

        print(f"Calculated forecasted PD for {len(result_df)} periods")
        return result_df
        
    except Exception as e:
        print(f"Error during forecasted PD calculation: {str(e)}")
        import traceback
        traceback.print_exc()
        return None