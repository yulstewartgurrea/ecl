import os
import json
import pandas as pd

from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from models.models import User, Workflow

from core.security import get_current_user

router = APIRouter(prefix="/api/flowrate_approach", tags=["flowrate-approach-processed-flow-rate-approach"])

@router.get("/processed_flow_rate_approach")
async def get_processed_flow_rate_approach(
    workflow_id: int = Query(..., description="Workflow ID to get data processed_flow_rate_approach"),
    current_user: User = Depends(get_current_user)
):

    try:
        # Sample flow_of_balance_principal_matrix
        flow_of_balance_principal_matrix = [
            {
                "Product": "AgriFin",
                "Date": "2025-08-31",
                "Total Loan Balance with C/P": "22,774,500.00",
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
                "Total Loan Balance with C/P": "24,105,400.00",
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
                "Total Loan Balance with C/P": "26,444,400.00",
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
                "Total Loan Balance with C/P": "41,347,500.00",
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
                "Total Loan Balance with C/P": "42,133,250.00",
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
                "Product": "AgriFin",
                "Date": "2025-03-31",
                "Total Loan Balance with C/P": "40,627,200.00",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "1,951,700.00",
                "PAR 30  (31 & 60 days)": "4,534,100.00",
                "PAR 60  (61 & 90 days)": "3,942,000.00",
                "PAR 90  (91 & 120 days)": "5,238,500.00",
                "PAR 120  (121 & 180 days)": "10,718,450.00",
                "PAR 180  (181 & 240 days)": "13,957,400.00",
                "PAR 240  (241 & 360 days)": "258,300.00",
                "PAR 360  (361 & Up days)": "26,750.00"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-02-28",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "-",
                "PAR 30  (31 & 60 days)": "-",
                "PAR 60  (61 & 90 days)": "-",
                "PAR 90  (91 & 120 days)": "-",
                "PAR 120  (121 & 180 days)": "-",
                "PAR 180  (181 & 240 days)": "-",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-01-31",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "-",
                "PAR 30  (31 & 60 days)": "-",
                "PAR 60  (61 & 90 days)": "-",
                "PAR 90  (91 & 120 days)": "-",
                "PAR 120  (121 & 180 days)": "-",
                "PAR 180  (181 & 240 days)": "-",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-12-31",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "-",
                "PAR 30  (31 & 60 days)": "-",
                "PAR 60  (61 & 90 days)": "-",
                "PAR 90  (91 & 120 days)": "-",
                "PAR 120  (121 & 180 days)": "-",
                "PAR 180  (181 & 240 days)": "-",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-11-30",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "-",
                "PAR 30  (31 & 60 days)": "-",
                "PAR 60  (61 & 90 days)": "-",
                "PAR 90  (91 & 120 days)": "-",
                "PAR 120  (121 & 180 days)": "-",
                "PAR 180  (181 & 240 days)": "-",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-10-31",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "-",
                "PAR 30  (31 & 60 days)": "-",
                "PAR 60  (61 & 90 days)": "-",
                "PAR 90  (91 & 120 days)": "-",
                "PAR 120  (121 & 180 days)": "-",
                "PAR 180  (181 & 240 days)": "-",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-09-30",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "-",
                "PAR 30  (31 & 60 days)": "-",
                "PAR 60  (61 & 90 days)": "-",
                "PAR 90  (91 & 120 days)": "-",
                "PAR 120  (121 & 180 days)": "-",
                "PAR 180  (181 & 240 days)": "-",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-08-31",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "-",
                "PAR 30  (31 & 60 days)": "-",
                "PAR 60  (61 & 90 days)": "-",
                "PAR 90  (91 & 120 days)": "-",
                "PAR 120  (121 & 180 days)": "-",
                "PAR 180  (181 & 240 days)": "-",
                "PAR 240  (241 & 360 days)": "-",
                "PAR 360  (361 & Up days)": "-"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-07-31",
                "Total Loan Balance with C/P": "-",
                "0 day": "",
                "PAR 1  (1 & 30 days)": "",
                "PAR 30  (31 & 60 days)": "",
                "PAR 60  (61 & 90 days)": "",
                "PAR 90  (91 & 120 days)": "",
                "PAR 120  (121 & 180 days)": "",
                "PAR 180  (181 & 240 days)": "",
                "PAR 240  (241 & 360 days)": "",
                "PAR 360  (361 & Up days)": ""
            }
        ]
        
        # Sample flow_of_balance_principal_matrix (distribution)
        flow_of_balance_principal_matrix_distribution = [
            {
                "Product": "AgriFin",
                "Date": "2025-08-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "2.32%",
                "PAR 30  (31 & 60 days)": "9.66%",
                "PAR 60  (61 & 90 days)": "10.71%",
                "PAR 90  (91 & 120 days)": "13.01%",
                "PAR 120  (121 & 180 days)": "23.48%",
                "PAR 180  (181 & 240 days)": "40.66%",
                "PAR 240  (241 & 360 days)": "0.17%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-07-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "2.75%",
                "PAR 30  (31 & 60 days)": "10.07%",
                "PAR 60  (61 & 90 days)": "10.77%",
                "PAR 90  (91 & 120 days)": "12.84%",
                "PAR 120  (121 & 180 days)": "23.51%",
                "PAR 180  (181 & 240 days)": "39.83%",
                "PAR 240  (241 & 360 days)": "0.23%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-06-30",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "3.24%",
                "PAR 30  (31 & 60 days)": "10.89%",
                "PAR 60  (61 & 90 days)": "11.09%",
                "PAR 90  (91 & 120 days)": "12.71%",
                "PAR 120  (121 & 180 days)": "23.50%",
                "PAR 180  (181 & 240 days)": "38.31%",
                "PAR 240  (241 & 360 days)": "0.26%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-05-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "3.53%",
                "PAR 30  (31 & 60 days)": "8.76%",
                "PAR 60  (61 & 90 days)": "8.22%",
                "PAR 90  (91 & 120 days)": "8.99%",
                "PAR 120  (121 & 180 days)": "16.80%",
                "PAR 180  (181 & 240 days)": "27.17%",
                "PAR 240  (241 & 360 days)": "26.48%",
                "PAR 360  (361 & Up days)": "0.06%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-04-30",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "4.42%",
                "PAR 30  (31 & 60 days)": "11.40%",
                "PAR 60  (61 & 90 days)": "8.65%",
                "PAR 90  (91 & 120 days)": "10.13%",
                "PAR 120  (121 & 180 days)": "20.43%",
                "PAR 180  (181 & 240 days)": "32.77%",
                "PAR 240  (241 & 360 days)": "12.13%",
                "PAR 360  (361 & Up days)": "0.06%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-03-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "4.80%",
                "PAR 30  (31 & 60 days)": "11.16%",
                "PAR 60  (61 & 90 days)": "9.70%",
                "PAR 90  (91 & 120 days)": "12.89%",
                "PAR 120  (121 & 180 days)": "26.38%",
                "PAR 180  (181 & 240 days)": "34.35%",
                "PAR 240  (241 & 360 days)": "0.64%",
                "PAR 360  (361 & Up days)": "0.07%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-02-28",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-01-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-12-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-11-30",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-10-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-09-30",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-08-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2024-07-31",
                "0 day": "0.00%",
                "PAR 1  (1 & 30 days)": "0.00%",
                "PAR 30  (31 & 60 days)": "0.00%",
                "PAR 60  (61 & 90 days)": "0.00%",
                "PAR 90  (91 & 120 days)": "0.00%",
                "PAR 120  (121 & 180 days)": "0.00%",
                "PAR 180  (181 & 240 days)": "0.00%",
                "PAR 240  (241 & 360 days)": "0.00%",
                "PAR 360  (361 & Up days)": "0.00%"
            }
        ]
        
        # Sample flow_rate_calculation
        flow_rate_calculation = [
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
                "PAR 1 to PAR 30": "331.31%",
                "PAR 30 to PAR 60": "100.50%",
                "PAR 60 to PAR 90": "114.14%",
                "PAR 90 to PAR 120": "172.74%",
                "PAR 120 to PAR 180": "163.39%",
                "PAR 180 to PAR 240": "0.41%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-06-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "283.38%",
                "PAR 30 to PAR 60": "90.14%",
                "PAR 60 to PAR 90": "105.58%",
                "PAR 90 to PAR 120": "168.64%",
                "PAR 120 to PAR 180": "154.47%",
                "PAR 180 to PAR 240": "0.55%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-05-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "197.47%",
                "PAR 30 to PAR 60": "80.98%",
                "PAR 60 to PAR 90": "98.88%",
                "PAR 90 to PAR 120": "167.29%",
                "PAR 120 to PAR 180": "145.88%",
                "PAR 180 to PAR 240": "0.62%",
                "PAR 240 to PAR 360": "0.00%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-04-30",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "194.57%",
                "PAR 30 to PAR 60": "70.73%",
                "PAR 60 to PAR 90": "101.95%",
                "PAR 90 to PAR 120": "162.68%",
                "PAR 120 to PAR 180": "130.49%",
                "PAR 180 to PAR 240": "79.29%",
                "PAR 240 to PAR 360": "0.52%",
                "PAR 360 above": "100.00%"
            },
            {
                "Product": "AgriFin",
                "Date": "2025-03-31",
                "0 Day to PAR 1": "0.00%",
                "PAR 1 to PAR 30": "246.19%",
                "PAR 30 to PAR 60": "80.37%",
                "PAR 60 to PAR 90": "108.30%",
                "PAR 90 to PAR 120": "164.34%",
                "PAR 120 to PAR 180": "128.83%",
                "PAR 180 to PAR 240": "36.61%",
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
            'data': {
                'flow_of_balance_principal_matrix': flow_of_balance_principal_matrix,
                'flow_of_balance_principal_matrix (distribution)': flow_of_balance_principal_matrix_distribution,
                'flow_rate_calculation': flow_rate_calculation
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


