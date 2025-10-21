import os
import json
import pandas as pd
import numpy as np
import traceback

from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from models.models import User, Workflow, Document
from models.flowrate_approach import FlowRateApproachAgingReport

from core.security import get_current_user
from database import SessionLocal

from helpers.timestamp_converter import timestamp_to_yyyy_mm_dd
from helpers.make_json_serializable import make_json_serializable
from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.get_root_folder import get_root_folder

from data_processing.flowrate_approach.flowrate_approach import flow_rate_main

router = APIRouter(prefix="/api/flowrate_approach", tags=["flowrate-approach-processed-flow-rate-approach"])

def parse_flow_file(path: str):
    titles = [
        "Flow of Loan Balance Principal Matrix",
        "Flow of Loan Balance Principal Matrix (Distribution)",
        "Flow Rate Calculation",
    ]

    # Determine file type and read accordingly
    file_extension = os.path.splitext(path)[1].lower()
    
    if file_extension in ['.xlsx', '.xls']:
        # Read Excel file
        df = pd.read_excel(path, header=None, engine="openpyxl", dtype=str, keep_default_na=False)
    elif file_extension == '.csv':
        # Read CSV file
        df = pd.read_csv(path, header=None, engine="python", dtype=str, keep_default_na=False)
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")
    
    df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x).replace({"": np.nan})

    # Locate section titles (first non-null cell equals a title)
    title_rows = [(i, next((df.iat[i, j] for j in range(df.shape[1]) if pd.notna(df.iat[i, j])), None))
                  for i in range(len(df))]
    title_rows = [(i, t) for i, t in title_rows if t in titles]
    title_indices = {i for i, _ in title_rows}

    out = {}
    for i, title in title_rows:
        # header row = first non-empty after title
        j = i + 1
        while j < len(df) and (df.iloc[j].isna().all() or (df.iloc[j].fillna("").astype(str).str.strip() == "").all()):
            j += 1
        if j >= len(df): 
            out[title] = []
            continue

        # data start
        header = [str(x).strip() if pd.notna(x) else "" for x in df.iloc[j].tolist()]
        while header and (header[-1] == "" or header[-1].lower() == "nan"):  # drop trailing empties
            header.pop()
        data_start = j + 1

        # end = next blank row or next title
        k = data_start
        while k < len(df) and k not in title_indices:
            row = df.iloc[k]
            if row.isna().all() or (row.fillna("").astype(str).str.strip() == "").all():
                break
            k += 1

        block = df.iloc[data_start:k, :len(header)].copy()
        block.columns = header

        # drop all-NaN columns (often trailing commas)
        block = block.dropna(axis=1, how="all")

        # strip strings and convert non-date cols to numeric
        for c in block.columns:
            block[c] = block[c].apply(lambda x: x.strip() if isinstance(x, str) else x)
            if c.lower() != "date":
                block[c] = pd.to_numeric(block[c], errors="coerce")

        # drop fully empty rows
        block = block.dropna(how="all")

        # NaN -> None for JSON
        out[title] = json.loads(block.where(pd.notna(block), None).to_json(orient="records"))

    return out

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

        parsed_data = parse_flow_file(document_file_path)
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': parsed_data
        }
        
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
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

        filename = f"flow_rate_output_{get_time_date()}.xlsx"
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

    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return JSONResponse(status_code=500, content=res)
