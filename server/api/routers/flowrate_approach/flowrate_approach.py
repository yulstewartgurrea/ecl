import os
import json
import pandas as pd
import numpy as np
import traceback

from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, FileResponse

from models.models import User, Workflow, Document
from models.flowrate_approach import FlowRateApproachAgingReport

from core.security import get_current_user
from database import SessionLocal

from helpers.timestamp_converter import timestamp_to_yyyy_mm_dd
from helpers.make_json_serializable import make_json_serializable
from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.get_root_folder import get_root_folder
from helpers.routers.parse_flowrate_output import parse_flowrate_output_file

from data_processing.flowrate_approach.flowrate_approach import flow_rate_main

router = APIRouter(prefix="/api/flowrate_approach", tags=["flowrate-approach-processed-flow-rate-approach"])



@router.get("/flow_rate")
async def get_processed_flow_rate_approach(
    workflow_id: int = Query(..., description="Workflow ID to get data processed_flow_rate_approach"),
    current_user: User = Depends(get_current_user)
):

    try:
        db = SessionLocal()
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()
        if not workflow:
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Workflow not found'
            })

        # get document by document_type and workflow_id
        document = db.query(Document).filter(
            Document.document_type == "FLOWRATE_APPROACH_FLOWRATE_OUTPUT",
            Document.workflow_id == workflow_id,
            Document.user_id == current_user.id
        ).order_by(Document.id.desc()).first()
        if not document:
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Document not found'
            })

        # get document file path
        document_file_path = os.path.join(get_root_folder(), 'files', document.workflow_path, 'output/flowrate_approach/', workflow.loan_product, 'flow_rate', document.filename)
        print(f"Reading file: {document_file_path}")
        
        # Check if file exists
        if not os.path.exists(document_file_path):
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Flowrate output file does not exist. Pls. run flowrate first.'
            })

        parsed_data = parse_flowrate_output_file(document_file_path)
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': parsed_data
        }
        
        return JSONResponse(status_code=200, content=res)
    except ValueError as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Error reading flow rate output file. {e}. Please re-run the flow rate calculation.'
        }
        return JSONResponse(status_code=400, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'An unexpected error occurred while retrieving flow rate data. Please contact support. Detail: {e}'
        }
        return JSONResponse(status_code=500, content=res)

@router.get("/flow_rate/export")
async def export_processed_flow_rate_approach(
    workflow_id: int = Query(..., description="Workflow ID to export flowrate output file"),
    current_user: User = Depends(get_current_user)
):
    try:
        db = SessionLocal()
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()
        if not workflow:
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Workflow not found'
            })

        # get document by document_type and workflow_id
        document = db.query(Document).filter(
            Document.document_type == "FLOWRATE_APPROACH_FLOWRATE_OUTPUT",
            Document.workflow_id == workflow_id,
            Document.user_id == current_user.id
        ).order_by(Document.id.desc()).first()
        if not document:
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Document not found'
            })

        # get document file path
        document_file_path = os.path.join(get_root_folder(), 'files', document.workflow_path, 'output/flowrate_approach/', workflow.loan_product, 'flow_rate', document.filename)
        print(f"Exporting file: {document_file_path}")
        
        # Check if file exists
        if not os.path.exists(document_file_path):
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Flowrate output file does not exist. Pls. run flowrate first.'
            })

        # Determine media type based on file extension
        file_ext = os.path.splitext(document.filename)[1].lower()
        if file_ext == '.xlsx':
            media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif file_ext == '.csv':
            media_type = 'text/csv'
        else:
            media_type = 'application/octet-stream'

        return FileResponse(
            path=document_file_path,
            filename=document.filename,
            media_type=media_type
        )
    except ValueError as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Error exporting flow rate output file. {e}. Please re-run the flow rate calculation.'
        }
        return JSONResponse(status_code=400, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'An unexpected error occurred while exporting flow rate data. Please contact support. Detail: {e}'
        }
        return JSONResponse(status_code=500, content=res)

@router.post("/flow_rate")
async def flow_rate_approach(
    workflow_id: int = Form(..., description="Workflow ID to get flowrate approach for"),
    current_user: User = Depends(get_current_user)
):
    try:
        db = SessionLocal()
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()
        if not workflow:
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Workflow not found'
            })

        aging_report = db.query(FlowRateApproachAgingReport).filter(
            FlowRateApproachAgingReport.workflow_id == workflow_id,
            FlowRateApproachAgingReport.user_id == current_user.id
        ).order_by(FlowRateApproachAgingReport.id.desc()).first()

        process_flow_rate_res = flow_rate_main(aging_report)

        filename = f"{workflow.loan_product}_flow_rate_output_{get_time_date()}.xlsx"
        output_folder = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/flowrate_approach/{workflow.loan_product}/flow_rate"
        document_type = "FLOWRATE_APPROACH_FLOWRATE_OUTPUT"

        # Save data in documents models
        db = SessionLocal()
        try:
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=None,
                document_type=document_type,
                user_id=current_user.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)

        finally:
            db.close()

        save_csv_data_in_folder(
            workflow_path=output_folder,
            document_type=document_type,
            # csv_data is a daraframe
            csv_data=process_flow_rate_res,
            filename=filename
        )

        res = {
            'code': 1,
            'success': True,
            'msg': 'Succes',
            'data': make_json_serializable(process_flow_rate_res)
        }
        return JSONResponse(status_code=200, content=res)

    except ValueError as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': str(e)
        }
        return JSONResponse(status_code=400, content=res)
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': f'An unexpected error occurred during flow rate calculation. Please contact support. Detail: {e}'
        }
        return JSONResponse(status_code=500, content=res)
