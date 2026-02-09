import os
import traceback
import pandas as pd
import re

from fastapi import APIRouter, Depends, HTTPException, Form, Query, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, Any, List, Optional
import json

from models.models import User, Workflow
from core.security import get_current_user
from data_processing.overlay.development.filtering_models import run_filter_models

from database import SessionLocal

from helpers.get_root_folder import get_root_folder
from helpers.get_time_date import get_time_date
from helpers.make_json_serializable import make_json_serializable

from pathlib import Path

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.post("/filtering_models")
async def start_model_filtering(
    workload_id: int = Form(...),
    filter_list: str = Form(...),  # JSON string that will be parsed
    current_user: User = Depends(get_current_user)
):
    try:
        import json
        db = SessionLocal()
        
        # Parse filter_list JSON string
        try:
            parsed_filter_list = json.loads(filter_list) if isinstance(filter_list, str) else filter_list
        except (json.JSONDecodeError, TypeError):
            parsed_filter_list = []
        
        workflow = db.query(Workflow).filter(
            Workflow.id == workload_id, 
            Workflow.user_id == current_user.id
        ).first()
        if not workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Workflow not found",
                    "data": None
                }
            )
        
        portfolio = workflow.loan_product
        ODR = "odr.logit"

        data_transformation_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/data_transformation"
        )

        data_multifactor_analysis_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/multifactor_analysis"
        )

        data_filtering_of_models_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/filtering_of_models"
        )
        os.makedirs(data_filtering_of_models_path, exist_ok=True)

        run_filter_models(
            portfolio,
            ODR,
            workflow.number_of_combinations,
            data_transformation_path,
            data_multifactor_analysis_path,
            data_filtering_of_models_path,
            parsed_filter_list
        )

        return JSONResponse(
            status_code=202,
            content={
                "code": 1,
                "success": True,
                "msg": "Success.",
                # "data": {
                #     "portfolio": portfolio,
                #     "target_variable": target_variable,
                #     "num_vars_taken": num_vars_taken
                # }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error starting model filtering: {str(e)}",
                "data": None
            }
        )

@router.get("/filtering_models")
async def get_filtered_results(
    workflow_id: int = Query(..., description="Workflow ID"),
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    page_size: int = Query(100, ge=1, le=1000, description="Number of rows per page (max 1000)"),
    filter: Optional[str] = Query(None, description="JSON array of filter objects. Format: [{\"column\": \"X1\", \"values\": [\"value1\", \"value2\"]}]"),
    variable_names: Optional[str] = Query(None, description="Comma-separated list of variable names to search for in X columns (e.g., 'gni,gdp,inf_food'). Searches across all X1, X2, X3, etc. columns."),
    current_user: User = Depends(get_current_user)
):
    """
    Get filtered model results with pagination
    
    Returns the best performing models that passed all filtering criteria.
    Supports pagination to handle large datasets efficiently.
    
    Filtering:
    - Use 'filter' query parameter with JSON array of filter objects
    - Format: [{"column": "X1", "values": ["value1", "value2", "value3"]}, {"column": "X2", "values": ["value4"]}]
    - Filters are applied to ALL rows before pagination
    - Multiple values for the same column use OR logic (X1 can be value1 OR value2 OR value3)
    - Different columns use AND logic (X1 must match AND X2 must match)
    
    Variable Name Filtering:
    - Use 'variable_names' query parameter with comma-separated variable names (e.g., 'gni,gdp,inf_food')
    - Searches across ALL X columns (X1, x1, X2, x2, X3, x3, etc.) case-insensitively
    - Returns rows where ANY X column contains ANY of the searched variable names
    - Multiple variable names use OR logic (row matches if X1=gni OR X2=gdp OR X3=inf_food, etc.)
    - NOTE: Cannot be used together with 'filter' parameter. Only one filter type can be used at a time.
    - When using 'variable_names', the filtered results are automatically saved to a file.
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id, 
                Workflow.user_id == current_user.id
            ).first()
            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "Workflow not found",
                        "data": None
                    }
                )

            portfolio = workflow.loan_product
            ODR = "odr.logit"
            
            filtering_of_models_path = (
                f"{get_root_folder()}/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{portfolio}/filtering_of_models"
            )
            
            filtering_of_models_file = max(
                Path(filtering_of_models_path).glob(f"{portfolio}_mfa_filtered_{ODR}_{workflow.number_of_combinations}_var_*"),
                key=lambda p: p.stat().st_mtime,   # last modified time
                default=None
            )
            
            if not filtering_of_models_file:
                return JSONResponse(
                    status_code=200,
                    content={
                        "code": 1,
                        "success": True,
                        "data": [],
                        "pagination": {
                            "page": page,
                            "page_size": page_size,
                            "total_rows": 0,
                            "total_pages": 0
                        }
                    }
                )
            
            # Read CSV file
            df = pd.read_csv(filtering_of_models_file)

            print(df)
            
            # Validate: Only one filter type can be used at a time
            if variable_names and filter:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "Cannot use both 'variable_names' and 'filter' parameters at the same time. Please use only one filter type.",
                        "data": None
                    }
                )
            
            # Start with all rows (True mask)
            mask = pd.Series([True] * len(df), index=df.index)
            
            # Initialize search_variables for later use in file saving
            search_variables = None
            
            # Apply variable name filter if provided
            if variable_names:
                try:
                    # Parse comma-separated variable names
                    if isinstance(variable_names, str):
                        search_variables = [v.strip() for v in variable_names.split(",") if v.strip()]
                    elif isinstance(variable_names, list):
                        search_variables = [str(v).strip() for v in variable_names if str(v).strip()]
                    else:
                        search_variables = []
                    
                    if search_variables:
                        # Find all X columns (X1, x1, X2, x2, etc.) - case-insensitive pattern
                        x_column_pattern = re.compile(r'^[Xx]\d+$', re.IGNORECASE)
                        x_columns = [col for col in df.columns if x_column_pattern.match(str(col))]
                        
                        if x_columns:
                            # Create a mask for variable name matching
                            # A row matches if ANY X column contains ANY of the searched variable names
                            variable_mask = pd.Series([False] * len(df), index=df.index)
                            
                            for x_col in x_columns:
                                # Check if this X column contains any of the searched variable names
                                column_matches = df[x_col].isin(search_variables)
                                variable_mask = variable_mask | column_matches
                            
                            # Combine with existing mask using AND logic
                            mask = mask & variable_mask
                        else:
                            # No X columns found, variable filter cannot be applied
                            # Return empty result or continue without variable filter
                            # For now, we'll return empty result if variable filter is requested but no X columns exist
                            mask = pd.Series([False] * len(df), index=df.index)
                    
                    # Save filtered file when variable_names filter is applied (same way as POST endpoint)
                    if search_variables and len(search_variables) > 0:
                        try:
                            # Apply the mask to filter the dataframe first
                            df_filtered = df[mask].reset_index(drop=True)
                            
                            # Ensure directory exists
                            os.makedirs(filtering_of_models_path, exist_ok=True)
                            
                            # Create filename with variable names suffix
                            variable_names_suffix = "_".join(search_variables[:3])  # Use first 3 variable names for filename
                            if len(search_variables) > 3:
                                variable_names_suffix += f"_and_{len(search_variables) - 3}_more"
                            
                            # Use same naming pattern as POST endpoint: {portfolio}_mfa_filtered_{ODR}_{num_vars_taken}_var_{timestamp}.csv
                            # Add variable_names suffix to distinguish filtered files
                            filtered_filename = f"{portfolio}_mfa_filtered_{ODR}_{workflow.number_of_combinations}_var_{get_time_date()}.csv"
                            filtered_file_path = Path(filtering_of_models_path) / filtered_filename
                            
                            # Save the filtered dataframe
                            df_filtered.to_csv(filtered_file_path, index=False)
                            print(f"Saved filtered file to: {filtered_file_path}")
                        except Exception as e:
                            print(f"Warning: Failed to save filtered file: {str(e)}")
                            # Continue even if save fails
                    
                except Exception as e:
                    return JSONResponse(
                        status_code=400,
                        content={
                            "code": -1,
                            "success": False,
                            "msg": f"Error processing variable_names filter: {str(e)}",
                            "data": None
                        }
                    )
            
            # Apply column-based filters if provided
            if filter:
                try:
                    # Parse JSON filter parameter
                    filter_list = json.loads(filter) if isinstance(filter, str) else filter
                    
                    # Validate filter format
                    if not isinstance(filter_list, list):
                        return JSONResponse(
                            status_code=400,
                            content={
                                "code": -1,
                                "success": False,
                                "msg": "Filter parameter must be a JSON array of filter objects",
                                "data": None
                            }
                        )
                    
                    # Apply each filter (mask already initialized above)
                    for filter_obj in filter_list:
                        if not isinstance(filter_obj, dict):
                            continue
                        
                        column_name = filter_obj.get("column")
                        values = filter_obj.get("values")
                        
                        if not column_name or not values:
                            continue
                        
                        # Check if column exists in dataframe
                        if column_name not in df.columns:
                            continue
                        
                        # Ensure values is a list
                        if not isinstance(values, list):
                            values = [values]
                        
                        # Use OR logic within a column (value can be any of the filter_values)
                        column_mask = df[column_name].isin(values)
                        mask = mask & column_mask
                    
                except json.JSONDecodeError:
                    return JSONResponse(
                        status_code=400,
                        content={
                            "code": -1,
                            "success": False,
                            "msg": "Invalid JSON format in filter parameter",
                            "data": None
                        }
                    )
                except Exception as e:
                    return JSONResponse(
                        status_code=400,
                        content={
                            "code": -1,
                            "success": False,
                            "msg": f"Error processing filter: {str(e)}",
                            "data": None
                        }
                    )
            
            # Apply the mask to filter the dataframe
            df = df[mask].reset_index(drop=True)
            
            # Calculate pagination on filtered data
            total_rows = len(df)
            total_pages = (total_rows + page_size - 1) // page_size if total_rows > 0 else 0
            
            # Validate page number
            if page > total_pages and total_pages > 0:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Page {page} exceeds total pages {total_pages}",
                        "data": None
                    }
                )
            
            # Slice DataFrame based on pagination
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            df_page = df.iloc[start_idx:end_idx]
            
            # Convert to dict records
            data = make_json_serializable(df_page.to_dict('records'))

            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "data": data,
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total_rows": total_rows,
                        "total_pages": total_pages,
                        "has_next": page < total_pages,
                        "has_previous": page > 1
                    }
                }
            )
        finally:
            db.close()
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error retrieving filtered results: {str(e)}",
                "data": None
            }
        )

@router.get("/filtering_models/column_values")
async def get_filtered_results_values(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id, 
                Workflow.user_id == current_user.id
            ).first()
            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "Workflow not found",
                        "data": None
                    }
                )

            portfolio = workflow.loan_product
            ODR = "odr.logit"

            filtering_of_models_path = (
                f"{get_root_folder()}/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{portfolio}/filtering_of_models"
            )

            filtering_of_models_file = max(
                Path(filtering_of_models_path).glob(f"{portfolio}_mfa_filtered_{ODR}_{workflow.number_of_combinations}_var_*"),
                key=lambda p: p.stat().st_mtime,   # last modified time
                default=None
            )
            
            if not filtering_of_models_file:
                return JSONResponse(
                    status_code=200,
                    content={
                        "code": 1,
                        "success": True,
                        "data": []
                    }
                )

            # Read CSV file
            df = pd.read_csv(filtering_of_models_file)

            # Get all columns where values are strings (contain more than 1 letter)
            # This excludes exponential notation (e.g., 1e-5, 2e10) which only has 1 'e'
            string_columns = []
            for col in df.columns:
                # Check if column contains any string values with at least 2 letters
                # Convert to string and check if any value contains 2 or more letters
                col_as_str = df[col].astype(str)
                # Check if any value in the column contains at least 2 letters (a-z or A-Z)
                # Pattern matches if there are at least 2 letters (with anything in between)
                has_multiple_letters = col_as_str.str.contains(r'[a-zA-Z].*[a-zA-Z]', na=False, regex=True).any()
                if has_multiple_letters:
                    string_columns.append(col)

            # Get unique values for each column header (only columns with letters)
            column_unique_values = {}
            for col in string_columns:
                # Get unique values, drop NaN, convert to list, and sort
                unique_vals = df[col].dropna().unique().tolist()
                # Convert to appropriate type (keep as is, but ensure JSON serializable)
                # Sort if possible (numbers and strings can be sorted)
                try:
                    # Try to sort if all values are of comparable types
                    unique_vals = sorted(unique_vals, key=lambda x: (str(x).lower() if isinstance(x, str) else x))
                except (TypeError, ValueError):
                    # If sorting fails (mixed types), keep original order
                    pass
                column_unique_values[col] = make_json_serializable(unique_vals)

            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "string_columns": string_columns,
                    "column_unique_values": column_unique_values
                }
            )
        finally:
            db.close()
            
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Something went wrong: {str(e)}",
                "data": None
            }
        )


@router.get("/filtering_models/mfa_file/headers")
async def get_mfa_file_headers(
    workflow_id: int = Query(..., description="Workflow ID"),
    filename: str = Query("001.csv", description="Filename to read (e.g., 001.csv)"),
    current_user: User = Depends(get_current_user)
):
    """
    Get the column headers (column names) from a specific MFA CSV file.
    
    Returns the headers/column names from a CSV file in the latest MFA results folder.
    This is useful for getting the structure of the MFA CSV file without loading all the data.
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id, 
                Workflow.user_id == current_user.id
            ).first()
            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "Workflow not found",
                        "data": None
                    }
                )

            portfolio = workflow.loan_product

            multifactor_analysis_output_path = (
                f"{get_root_folder()}/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{portfolio}/multifactor_analysis"
            )

            if not os.path.exists(multifactor_analysis_output_path):
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Multifactor analysis directory not found: {multifactor_analysis_output_path}",
                        "data": None
                    }
                )

            folder_path = Path(multifactor_analysis_output_path)

            print(folder_path, workflow.number_of_combinations)
            
            # Look for folders matching the pattern
            mfa_folders = list(folder_path.glob(f"{portfolio}_mfa_*_{workflow.number_of_combinations}-var_*"))
            print('mfa \n', mfa_folders)
            
            if not mfa_folders:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"No MFA results folder found for portfolio {portfolio}",
                        "data": None
                    }
                )
            
            # Get the most recent folder
            mfa_folder = max(mfa_folders, key=lambda p: p.stat().st_mtime)
            
            # Construct file path
            file_path = mfa_folder / filename
            
            # Security: ensure filename doesn't contain path traversal
            if not file_path.exists() or not str(file_path).startswith(str(mfa_folder)):
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"File not found: {filename}",
                        "data": None
                    }
                )
            
            # Read just the headers (first row) from the CSV
            headers = pd.read_csv(file_path, nrows=0).columns.tolist()

            # exlcude headers that start with "X" or "x" and end with a number
            headers = [header for header in headers if not header.startswith("X") and not header.startswith("x") and not header.endswith("X") and not header.endswith("x")]

            # exclude header 'Y' or 'y'
            headers = [header for header in headers if header.upper() != "Y"]
            
            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "msg": "Headers retrieved successfully",
                    "data": {
                        "headers": headers,
                        "total_columns": len(headers),
                        "filename": filename,
                        "folder_name": mfa_folder.name
                    }
                }
            )
        finally:
            db.close()
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error retrieving headers: {str(e)}",
                "data": None
            }
        )


@router.get("/filtering_models/export")
async def export_filtered_results(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """Export the latest filtered models CSV based on the same logic as the GET endpoint."""
    try:
        db = SessionLocal()
        
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id, 
            Workflow.user_id == current_user.id
        ).first()
        if not workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Workflow not found",
                    "data": None
                }
            )

        portfolio = workflow.loan_product
        ODR = "odr.logit"
        
        filtering_of_models_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/filtering_of_models"
        )

        filtering_of_models_file = max(
            Path(filtering_of_models_path).glob(f"{portfolio}_mfa_filtered_{ODR}_{workflow.number_of_combinations}_var_*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )

        if not filtering_of_models_file:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Filtered results file not found",
                    "data": None
                }
            )

        filename = os.path.basename(str(filtering_of_models_file))
        return FileResponse(str(filtering_of_models_file), media_type="text/csv", filename=filename)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error exporting filtered results: {str(e)}",
                "data": None
            }
        )
