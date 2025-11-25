from fastapi import APIRouter, HTTPException, Depends, Form, Query
from fastapi.responses import JSONResponse, FileResponse
from starlette.responses import StreamingResponse
from io import BytesIO
import zipfile

import pandas as pd
import numpy as np
import os
import json
import traceback
from datetime import datetime

from typing import List, Dict, Any, Optional
from helpers.file_utils import find_and_read_data_file, get_root_folder
from data_processing.overlay.execution.transform_forecasted_mevs import process_transform_forecasted_mevs

from database import SessionLocal

from core.security import get_current_user

from models.models import User, Document, Workflow
from models.overlay.development import (
    OverlayDevelopmentMonthlyHistoricalMevInput,
    OverlayDevelopmentDataInterpolationOutput,
    OverlayDevelopmentHistoricalDefaultRateInput,
    OverlayDevelopmentDataTransformationOutput,
    OverlayLogs
)

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.file_utils import read_data_file
from helpers.get_latest_file import get_latest_file

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])

@router.post("/transform_forecasted_mevs")
async def calculate_transform_forecasted_mevs(workflow_id: int = Form(...),
                                              user_id: User = Depends(get_current_user)):
    """
        Calculate data transformation
    """
    try:
        document_type = "OVERLAY_EXECUTION_TRANSFORM_FORECASTED_MEVS_OUTPUT"
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
            # log_record = db.query(OverlayLogs).filter(
            #     OverlayLogs.workflow_id == workflow_id,
            #     OverlayLogs.submodule == "EXECUTION"
            # ).first()

            # Get data interpolation 
            data_interpolation_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/data_interpolation"
            )

            # Get input file from library (same as GET endpoint)
            override_forecasted_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/override_forecasted_mevs"
            )

            data_interpolation_file = get_latest_file(data_interpolation_path)
            override_forecasted_mevs_file = get_latest_file(override_forecasted_mevs_path)

            print('data_interpolation_file', data_interpolation_file)
            print('override_forecasted_mevs_file', override_forecasted_mevs_file)

            data_interpolation_df = read_data_file(data_interpolation_file)
            override_forecasted_mevs_df = read_data_file(override_forecasted_mevs_file)

            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No workflow found for this workflow id",
                        "data": None
                    }
                )

            # if not log_record:
            #     return JSONResponse(
            #         status_code=404,
            #         content={
            #             "code": -1,
            #             "success": False,
            #             "msg": "No log record found for this workflow",
            #             "data": None
            #         }
            #     )

            if data_interpolation_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No data interpolation data found for this workflow",
                        "data": None
                    }
                )

            if override_forecasted_mevs_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No override forecasted MEVs data found for this workflow",
                        "data": None
                    }
                )
        finally:
            db.close()

        process_transform_forecasted_mevs_res = process_transform_forecasted_mevs(
            data_interpolation_df,
            override_forecasted_mevs_df)
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success'
        }

        filename = f"transform_forecasted_mevs_output_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/execution/{workflow.loan_product}/transform_forecasted_mevs"
        
        # Save data in documents models
        db = SessionLocal()
        try:
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=None,
                document_type=document_type,
                user_id=user_id.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)

        finally:
            db.close()

        save_csv_data_in_folder(
            workflow_path=output_folder_path,
            document_type=document_type,
            # csv_data is a daraframe
            csv_data=process_transform_forecasted_mevs_res,
            filename=filename
        )

        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)


@router.get("/transform_forecasted_mevs")
async def get_transform_forecasted_mevs_results(workflow_id: int = Query(...),
                                         current_user: User = Depends(get_current_user)):
    """
    Get data interpolation data from OverlayDevelopmentDataInterpolationOutput table
    """
    try:
        db = SessionLocal()
        try:

            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            # Query the database for data interpolation output
            # get input file from library 
            transform_forecasted_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/transform_forecasted_mevs"
            )

            print('transform_forecasted_mevs_path', transform_forecasted_mevs_path)
            
            # Get the latest file in the directory
            transform_forecasted_mevs_file = get_latest_file(transform_forecasted_mevs_path)

            print('transform_forecasted_mevs_file', transform_forecasted_mevs_file)
            
            if not transform_forecasted_mevs_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No override forecasted MEVs file found for this workflow",
                        "data": None
                    }
                )
            
            # Determine file type based on extension
            file_ext = transform_forecasted_mevs_file.suffix.lower()
            
            data = None
            if file_ext in ['.xlsx', '.xls']:
                # Read Excel file
                print(f"Detected Excel file: {file_ext}")
                data = pd.read_excel(transform_forecasted_mevs_file)
            elif file_ext == '.csv':
                # Read CSV file
                print(f"Detected CSV file")
                data = pd.read_csv(transform_forecasted_mevs_file)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls")
            
            print(data)
            return {
                "code": 1, 
                "success": True,
                'data': data.to_dict(orient='records')
            }
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving data interpolation: {str(e)}",
                "data": None
            }
        )


@router.get("/transform_forecasted_mevs/export")
async def export_transform_forecasted_mevs(
    workflow_id: int = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Export latest transform forecasted MEVs data as CSV or Excel file."""
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            transform_forecasted_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/transform_forecasted_mevs"
            )

            if not os.path.exists(transform_forecasted_mevs_path):
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"Transform forecasted MEVs directory not found: {transform_forecasted_mevs_path}"}
                )

            # Get the latest file in the directory
            transform_forecasted_mevs_file = get_latest_file(transform_forecasted_mevs_path)

            if not transform_forecasted_mevs_file:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "No transform forecasted MEVs file found"}
                )

            # Convert Path object to string for FileResponse
            file_path = str(transform_forecasted_mevs_file)
            filename = transform_forecasted_mevs_file.name

            # Determine media type based on file extension
            file_ext = transform_forecasted_mevs_file.suffix.lower()
            if file_ext in ['.xlsx', '.xls']:
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            elif file_ext == '.csv':
                media_type = "text/csv"
            else:
                return JSONResponse(
                    status_code=400,
                    content={"detail": f"Unsupported file format: {file_ext}"}
                )

            return FileResponse(
                file_path,
                media_type=media_type,
                filename=filename,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        finally:
            db.close()
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting transform forecasted MEVs: {str(e)}",
                "data": None
            }
        )


@router.get("/data_transformation_results/export")
async def export_data_transformation_results(
    workflow_id: int = Query(...),
    file_type: str = Query("both", description="independent | dependent | both"),
    current_user: User = Depends(get_current_user)
):
    """Export latest transformed data as CSV or ZIP (based on get endpoint logic)."""
    try:
        root_folder = get_root_folder()
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            portfolio = workflow.loan_product or "Housing"
            server_files_path = f"{root_folder}/server/files/{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/development/{portfolio}/data_transformation"

            if not os.path.exists(server_files_path):
                return JSONResponse(status_code=404, content={"detail": f"Data transformation directory not found: {server_files_path}"})

            files = os.listdir(server_files_path)

            independent_files = [f for f in files if f.startswith(f"{portfolio}_Independent - Transformed with Time") and f.endswith('.csv')]
            dependent_files = [f for f in files if f.startswith(f"{portfolio}_Dependent - Transformed with Time") and f.endswith('.csv')]

            if not independent_files and not dependent_files:
                return JSONResponse(status_code=404, content={"detail": "No transformed data files found"})

            independent_path = None
            dependent_path = None
            if independent_files:
                independent_path = os.path.join(server_files_path, sorted(independent_files)[-1])
            if dependent_files:
                dependent_path = os.path.join(server_files_path, sorted(dependent_files)[-1])

            # Normalize file_type
            ft = (file_type or "both").lower()
            if ft not in ("independent", "dependent", "both"):
                return JSONResponse(status_code=400, content={"detail": "Invalid file_type. Use independent | dependent | both"})

            # Single file export as direct CSV
            if ft == "independent":
                if not independent_path:
                    return JSONResponse(status_code=404, content={"detail": "Independent file not found"})
                filename = os.path.basename(independent_path)
                return FileResponse(independent_path, media_type="text/csv", filename=filename)

            if ft == "dependent":
                if not dependent_path:
                    return JSONResponse(status_code=404, content={"detail": "Dependent file not found"})
                filename = os.path.basename(dependent_path)
                return FileResponse(dependent_path, media_type="text/csv", filename=filename)

            # Both: stream a zip containing both files
            mem_file = BytesIO()
            with zipfile.ZipFile(mem_file, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                if independent_path:
                    zf.write(independent_path, arcname=os.path.basename(independent_path))
                if dependent_path:
                    zf.write(dependent_path, arcname=os.path.basename(dependent_path))
            mem_file.seek(0)

            zip_name = f"{portfolio}_Transformed_Data_{get_time_date()}.zip"
            return StreamingResponse(
                mem_file,
                media_type="application/zip",
                headers={"Content-Disposition": f"attachment; filename={zip_name}"}
            )
        finally:
            db.close()
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting data transformation results: {str(e)}",
                "data": None
            }
        )