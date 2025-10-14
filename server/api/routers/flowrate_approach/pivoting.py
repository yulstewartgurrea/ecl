import os
import json
import pandas as pd

from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from models.models import User, Workflow

from core.security import get_current_user

router = APIRouter(prefix="/api/flowrate_approach", tags=["flowrate-approach-data-consolidation"])

@router.get("/pivoting")
async def get_pivoting(
    workflow_id: int = Query(..., description="Workflow ID to get pivoting for"),
    current_user: User = Depends(get_current_user)
):

    try:
        # Sample pivoted data
        pivoted_data = [
            {
                "Product": "AgriFin",
                "Date": "2025-08-31",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "528,200.00",
                "PAR 30  (31 & 60 days)": "2,199,100.00",
                "PAR 60  (61 & 90 days)": "2,439,250.00",
                "PAR 90  (91 & 120 days)": "2,962,250.00",
                "PAR 120  (121 & 180 days)": "5,347,400.00",
                "PAR 180  (181 & 240 days)": "9,259,400.00",
                "PAR 240  (241 & 360 days)": "38,900.00",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-07-31",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "663,750.00",
                "PAR 30  (31 & 60 days)": "2,427,150.00",
                "PAR 60  (61 & 90 days)": "2,595,200.00",
                "PAR 90  (91 & 120 days)": "3,095,650.00",
                "PAR 120  (121 & 180 days)": "5,667,050.00",
                "PAR 180  (181 & 240 days)": "9,601,200.00",
                "PAR 240  (241 & 360 days)": "55,400.00",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-06-30",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "856,500.00",
                "PAR 30  (31 & 60 days)": "2,879,100.00",
                "PAR 60  (61 & 90 days)": "2,932,100.00",
                "PAR 90  (91 & 120 days)": "3,360,450.00",
                "PAR 120  (121 & 180 days)": "6,215,650.00",
                "PAR 180  (181 & 240 days)": "10,131,400.00",
                "PAR 240  (241 & 360 days)": "69,200.00",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-05-31",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "1,458,000.00",
                "PAR 30  (31 & 60 days)": "3,620,900.00",
                "PAR 60  (61 & 90 days)": "3,398,650.00",
                "PAR 90  (91 & 120 days)": "3,715,400.00",
                "PAR 120  (121 & 180 days)": "6,945,100.00",
                "PAR 180  (181 & 240 days)": "11,233,700.00",
                "PAR 240  (241 & 360 days)": "10,949,000.00",
                "PAR 360  (361 & Up days)": "26,750.00"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-04-30",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "1,860,950.00",
                "PAR 30  (31 & 60 days)": "4,804,950.00",
                "PAR 60  (61 & 90 days)": "3,644,250.00",
                "PAR 90  (91 & 120 days)": "4,269,100.00",
                "PAR 120  (121 & 180 days)": "8,608,900.00",
                "PAR 180  (181 & 240 days)": "13,808,250.00",
                "PAR 240  (241 & 360 days)": "5,110,100.00",
                "PAR 360  (361 & Up days)": "26,750.00"
            },
            {
                "Product": "EducFin Junior",
                "Date": "2025-08-31",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "2,304,800.00",
                "PAR 30  (31 & 60 days)": "1,240,800.00",
                "PAR 60  (61 & 90 days)": "1,374,400.00",
                "PAR 90  (91 & 120 days)": "1,926,650.00",
                "PAR 120  (121 & 180 days)": "2,732,700.00",
                "PAR 180  (181 & 240 days)": "1,481,650.00",
                "PAR 240  (241 & 360 days)": "4,200.00",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "EducFin Junior",
                "Date": "2025-07-31",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "2,482,500.00",
                "PAR 30  (31 & 60 days)": "1,278,500.00",
                "PAR 60  (61 & 90 days)": "1,399,800.00",
                "PAR 90  (91 & 120 days)": "1,939,600.00",
                "PAR 120  (121 & 180 days)": "2,770,650.00",
                "PAR 180  (181 & 240 days)": "1,518,050.00",
                "PAR 240  (241 & 360 days)": "4,200.00",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "EducFin Senior",
                "Date": "2025-08-31",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "2,501,250.00",
                "PAR 30  (31 & 60 days)": "1,567,100.00",
                "PAR 60  (61 & 90 days)": "1,627,550.00",
                "PAR 90  (91 & 120 days)": "1,712,950.00",
                "PAR 120  (121 & 180 days)": "3,185,950.00",
                "PAR 180  (181 & 240 days)": "2,005,350.00",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "EducFin Senior",
                "Date": "2025-07-31",
                "Total Loan Balance with C/P": "",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "2,658,850.00",
                "PAR 30  (31 & 60 days)": "1,617,500.00",
                "PAR 60  (61 & 90 days)": "1,668,850.00",
                "PAR 90  (91 & 120 days)": "1,734,550.00",
                "PAR 120  (121 & 180 days)": "3,210,150.00",
                "PAR 180  (181 & 240 days)": "2,029,350.00",
                "PAR 240  (241 & 360 days)": "1,500.00",
                "PAR 360  (361 & Up days)": "-"
            }
        ]
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': pivoted_data
        }
        
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return JSONResponse(status_code=500, content=res)


