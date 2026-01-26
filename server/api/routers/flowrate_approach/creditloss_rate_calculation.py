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

from data_processing.flowrate_approach.creditloss_rate import creditloss_rate_main

from pathlib import Path

router = APIRouter(prefix="/api/flowrate_approach", tags=["flowrate-approach-processed-flow-rate-approach"])

@router.get("/credit_loss_calculation")
async def get_credit_loss_calculation(
    workflow_id: int = Query(..., description="Workflow ID to get data credit loss calculation"),
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
            Document.document_type == "FLOWRATE_APPROACH_CREDITLOSS_RATE_OUTPUT",
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
        document_file_path = os.path.join(
            get_root_folder(),
            'files',
            document.workflow_path,
            'output/flowrate_approach/',
            workflow.loan_product,
            'creditloss_rate',
            document.filename)
        print(f"Reading file: {document_file_path}")
        
        # Check if file exists
        if not os.path.exists(document_file_path):
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Creditloss rate output file does not exist. Pls. run creditloss rate first.'
            })

        df = pd.read_excel(document_file_path)
        
        # Convert date column to string to avoid JSON serialization issues
        if 'date' in df.columns:
            # Store original values for non-datetime entries (like "Average")
            original_dates = df['date'].copy()
            # Convert datetime objects to string format
            df['date'] = pd.to_datetime(df['date'], errors='coerce').dt.strftime('%Y-%m-%d')
            # Fill NaN values (like "Average") back to their original string values
            mask = df['date'].isna()
            if mask.any():
                df.loc[mask, 'date'] = original_dates[mask].astype(str)
        
        print(document_file_path)
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': make_json_serializable(df.to_dict(orient='records'))
        }
        
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return JSONResponse(status_code=500, content=res)

@router.get("/credit_loss_calculation/export")
async def export_credit_loss_calculation(
    workflow_id: int = Query(..., description="Workflow ID to export credit loss calculation file"),
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
            Document.document_type == "FLOWRATE_APPROACH_CREDITLOSS_RATE_OUTPUT",
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
        document_file_path = os.path.join(
            get_root_folder(),
            'files',
            document.workflow_path,
            'output/flowrate_approach/',
            workflow.loan_product,
            'creditloss_rate',
            document.filename)
        print(f"Exporting file: {document_file_path}")
        
        # Check if file exists
        if not os.path.exists(document_file_path):
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Creditloss rate output file does not exist. Pls. run creditloss rate first.'
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
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return JSONResponse(status_code=500, content=res)

@router.post("/credit_loss_calculation")
async def credit_loss_calculation(
    workflow_id: int = Form(..., description="Workflow ID to get credit loss calculation for"),
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

        # get flowrate output
        flowrate_output_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/flowrate_approach/{workflow.loan_product}/flow_rate"
        )

        flowrate_output_file = max(
            Path(flowrate_output_path).glob(f"{workflow.loan_product}_flow_rate_output*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )
        
        if not os.path.exists(flowrate_output_path):
            return JSONResponse(status_code=404, content={
                'code': -1,
                'success': False,
                'msg': 'Flowrate output file does not exist. Pls. run flowrate first.'
            })

        # returns a dictionary
        flowrate_output_data = parse_flowrate_output_file(flowrate_output_file)
        # print('flowrate_output_data \n', flowrate_output_data)

        creditloss_rate_res = creditloss_rate_main(flowrate_output_data)
        print('creditloss_rate_res \n', creditloss_rate_res)

        filename = f"{workflow.loan_product}_creditloss_rate_{get_time_date()}.xlsx"
        output_folder = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/flowrate_approach/{workflow.loan_product}/creditloss_rate"
        document_type = "FLOWRATE_APPROACH_CREDITLOSS_RATE_OUTPUT"

        # # Save data in documents models
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
            csv_data=creditloss_rate_res['data'],
            filename=filename
        )

        res = {
            'code': 1,
            'success': True,
            'msg': 'Succes'
        }
        return JSONResponse(status_code=200, content=res)

    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return JSONResponse(status_code=500, content=res)
