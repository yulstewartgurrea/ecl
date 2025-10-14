import os
import json
import pandas as pd

from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from models.models import User, Workflow

from core.security import get_current_user

router = APIRouter(prefix="/api/flowrate_approach", tags=["flowrate-approach-data-consolidation"])

@router.get("/data_consolidation")
async def get_data_consolidation(
    workflow_id: int = Query(..., description="Workflow ID to get data consolidation for"),
    current_user: User = Depends(get_current_user)
):

    try:
        # Sample data_summary
        data_summary = [
            {"Unique Report Dates": "2024-07-31", "Unique Product": "AgriFin", "Index": 1},
            {"Unique Report Dates": "2024-08-31", "Unique Product": "EducFin Junior", "Index": 2},
            {"Unique Report Dates": "2024-09-30", "Unique Product": "EducFin Senior", "Index": 3},
            {"Unique Report Dates": "2024-10-31", "Unique Product": "HomFin", "Index": 4},
            {"Unique Report Dates": "2024-11-30", "Unique Product": "HomFin (100)", "Index": 5},
            {"Unique Report Dates": "2024-12-31", "Unique Product": "HomFin (145)", "Index": 6},
            {"Unique Report Dates": "2025-01-31", "Unique Product": "kalikASAn-Fin", "Index": 7},
            {"Unique Report Dates": "2025-02-28", "Unique Product": "MalASAkit / Quard Hassan", "Index": 8},
            {"Unique Report Dates": "2025-03-31", "Unique Product": "Micro-Business", "Index": 9},
            {"Unique Report Dates": "2025-04-30", "Unique Product": "Micro-Business (46)", "Index": 10},
            {"Unique Report Dates": "2025-05-31", "Unique Product": "Micro-Business 23 (Recovery)", "Index": 11},
            {"Unique Report Dates": "2025-06-30", "Unique Product": "TaLiMa", "Index": 12},
            {"Unique Report Dates": "2025-07-31", "Unique Product": "Tawid Negosyo (Emergency) (10)", "Index": 13},
            {"Unique Report Dates": "2025-08-31", "Unique Product": "WaSaFin", "Index": 14},
            {"Unique Report Dates": "", "Unique Product": "HomFin (70)", "Index": 15}
        ]
        
        # Sample consolidated_data
        consolidated_data = [
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "0 day",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 1  (1 & 30 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 30  (31 & 60 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 60  (61 & 90 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 90  (91 & 120 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 120  (121 & 180 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 180  (181 & 240 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 240  (241 & 360 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "AgriFin",
                "Aging Category": "PAR 360  (361 & Up days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "EducFin Junior",
                "Aging Category": "0 day",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            },
            {
                "Report Date": "2024-07-31",
                "Product": "EducFin Junior",
                "Aging Category": "PAR 1  (1 & 30 days)",
                "Product Counts": "",
                "Loan Balance w/ CP": "",
                "Loan Balance Principal": "",
                "NET PAR Amount Loan Balance w/ CP": "",
                "NET PAR Amount Loan Balance Principal": "",
                "NET PAR % (Gross PAR/TLP)": "",
                "Repayment Rate": ""
            }
        ]
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': {
                'data_summary': data_summary,
                'consolidated_data': consolidated_data
            }
        }
        
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return JSONResponse(status_code=500, content=res)


