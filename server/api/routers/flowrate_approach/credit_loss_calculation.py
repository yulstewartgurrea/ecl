import os
import json
import pandas as pd

from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from models.models import User, Workflow

from core.security import get_current_user

router = APIRouter(prefix="/api/flowrate_approach", tags=["flowrate-approach-data-consolidation"])

@router.get("/credit_loss_calculation")
async def get_credit_loss_calculation(
    workflow_id: int = Query(..., description="Workflow ID to get credit loss calculation for"),
    current_user: User = Depends(get_current_user)
):

    try:
        # Sample credit loss calculation data
        credit_loss_calculation_res = [
            {
                "Product": "AgriFin",
                "Date": "2025-08-31",
                "0 Day to PAR 1": "",
                "PAR 1 to PAR 30": "",
                "PAR 30 to PAR 60": "",
                "PAR 60 to PAR 90": "",
                "PAR 90 to PAR 120": "",
                "PAR 120 to PAR 180": "",
                "PAR 180 to PAR 240": "",
                "PAR 240 to PAR 360": "",
                "PAR 360 above": ""
            },
            {
                "Product": "AgriFin",
                "Date": "2025-07-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-06-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-05-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-04-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "1.24%",
                "PAR 30 to PAR 60": "0.64%",
                "PAR 60 to PAR 90": "0.90%",
                "PAR 90 to PAR 120": "0.88%",
                "PAR 120 to PAR 180": "0.54%",
                "PAR 180 to PAR 240": "0.42%",
                "PAR 240 to PAR 360": "0.52%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-03-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "17.20%",
                "PAR 30 to PAR 60": "6.99%",
                "PAR 60 to PAR 90": "8.69%",
                "PAR 90 to PAR 120": "8.03%",
                "PAR 120 to PAR 180": "4.88%",
                "PAR 180 to PAR 240": "3.79%",
                "PAR 240 to PAR 360": "10.36%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-02-28",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-01-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-12-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-11-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-10-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-09-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-09-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-09-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "0.00%",
                "PAR 30 to PAR 60": "0.00%",
                "PAR 60 to PAR 90": "0.00%",
                "PAR 90 to PAR 120": "0.00%",
                "PAR 120 to PAR 180": "0.00%",
                "PAR 180 to PAR 240": "0.00%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            }
        ]
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': credit_loss_calculation_res
        }
        
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return JSONResponse(status_code=500, content=res)


