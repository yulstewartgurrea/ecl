from typing import List, Optional
import json
import os
import pathlib
import numpy as np
import pandas as pd
import math

from collections import defaultdict, Counter
from schemas.schemas import DocumentResponse, DocumentCreate , JsonCreate
from models.models import User
from database import get_db
from helpers.document import get_documents, create_document, delete_document
from core.security import get_current_user
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Body, Query
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from pathlib import Path
from datetime import datetime
from io import BytesIO
from typing import List, Dict, Any
from models.models import Document, Json
from starlette.responses import StreamingResponse
router = APIRouter(prefix="/documents", tags=["documents"])

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
EXCEL_FILES_DIR = BASE_DIR / "files"
DATE_FORMAT = "%Y-%m-%d"

@router.get("/", response_model=List[DocumentResponse])
def read_documents(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    documents = get_documents(db, user_id=current_user.id, skip=skip, limit=limit)
    return documents

@router.post("/", response_model=List[DocumentResponse], status_code=status.HTTP_201_CREATED)
def insert_documents(
    documents: List[DocumentCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    created_documents = []
    for document in documents:
        created = create_document(db=db, document=document, user_id=current_user.id)
        created_documents.append(created)
    return created_documents


@router.get("/workflows/check")
def check_workflow_exists(
    entity: str = Query(..., description="Entity name, e.g., BanKo"),
    reporting_period: str = Query(..., description="Reporting period, e.g., Annually"),
    workflow_name: str = Query(..., description="Workflow name, e.g., asdsdf"),
    db: Session = Depends(get_db),
   current_user: User = Depends(get_current_user),
):
    # Build the workflow_path string
    workflow_path = f"/{entity}/{reporting_period}/{workflow_name}"

    # Query the document table for that path and user_id (optional: filter by current user)
    doc = db.query(Document).filter(
        Document.workflow_path == workflow_path,
        Document.user_id == current_user.id
    ).first()

    exists = doc is not None

    return {"exists": exists}

@router.get("/workflows/files", response_model=List[str])
def list_excel_files(
    entity: str = Query(..., description="Entity name, e.g., BanKo"),
    reporting_period: str = Query(..., description="Reporting period, e.g., Annually"),
    workflow_name: str = Query(..., description="Workflow name, e.g., asdsdf"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow_path = f"/{entity}/{reporting_period}/{workflow_name}"

    docs = db.query(Document).filter(
        Document.workflow_path == workflow_path,
        Document.user_id == current_user.id
    ).all()

    # Filter only Excel files by extension
    excel_files = [
        doc.filename for doc in docs
        if doc.filename.lower().endswith((".xlsx", ".xls"))
    ]

    return excel_files

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not delete_document(db, document_id=document_id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Document not found")
    return None


def sanitize_for_json(row_dict):
    def clean_value(v):
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        if isinstance(v, (pd.Timestamp, datetime)):
            return v.strftime("%d/%m/%Y")  # Format as DD/MM/YYYY
        return v

    return {k: clean_value(v) for k, v in row_dict.items()}

@router.get("/read-excel")
def read_single_excel(
    workflow_path: str = Query(..., description="Subdirectory under server/files containing Excel files"),
    db: Session = Depends(get_db),
):
    from datetime import datetime

    base_dir = Path(__file__).parents[2] / "files"
    cleaned_path = workflow_path.strip('"/')
    excel_dir = base_dir / cleaned_path

    records = db.query(Document).filter(Document.workflow_path == workflow_path).all()
    if not records:
        return JSONResponse(status_code=404, content={"detail": f"No records found for workflow_path '{cleaned_path}'"})

    if not excel_dir.exists() or not excel_dir.is_dir():
        return JSONResponse(status_code=404, content={"detail": f"Directory not found: {excel_dir}"})

    excel_files = [f for f in excel_dir.iterdir() if f.is_file() and f.suffix in (".xlsx", ".xls")]
    if not excel_files:
        return JSONResponse(status_code=404, content={"detail": "No Excel files found in directory"})

    expected_cols = [
        "report_date", "loan_segment", "cis_number", "pn_number",
        "loan_amount", "outstanding_balance", "amortization", "booking_date",
        "maturity_date", "eir", "monthly_payments", "dpd"
    ]

    all_processed = []
    def sanitize_for_json(row_dict):
        def clean_value(v):
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            if isinstance(v, (pd.Timestamp, datetime)):
                return v.strftime("%d/%m/%Y")  # Format as DD/MM/YYYY
            return v

        return {k: clean_value(v) for k, v in row_dict.items()}

    try:
        for file_path in excel_files:
            df = pd.read_excel(file_path, engine="openpyxl")
            df.replace({np.nan: None}, inplace=True)

            original_records = df.to_dict(orient="records")
            safe_original = [sanitize_for_json(row) for row in original_records]

            # 🔍 Find the matching record for this file (assuming filename is stored in a field)
            matching_record = next((r for r in records if r.filename == file_path.name), None)

            if matching_record:
                matching_record.json_data = json.dumps(safe_original)

            # Skip processing if expected columns are missing
            missing_cols = [col for col in expected_cols if col not in df.columns]
            if missing_cols:
                continue

            df.replace([np.inf, -np.inf], np.nan, inplace=True)

            processed_rows = []
            valid_count = 0
            missing_count = 0

            for _, row in df[expected_cols].iterrows():
                row_dict = row.to_dict()
                is_missing = any(pd.isna(v) or v == "" for v in row_dict.values())
                row_dict["status"] = "missing" if is_missing else "valid"
                row_dict["source_file"] = file_path.name

                if is_missing:
                    missing_count += 1
                else:
                    valid_count += 1

                processed_rows.append(sanitize_for_json(row_dict))

            total_rows = len(df)
            error_count = total_rows - (valid_count + missing_count)

            all_processed.append({
                "filename": file_path.name,
                "valid": valid_count,
                "missing": missing_count,
                "error": error_count,
                "rows": processed_rows
            })

        db.commit()

        if not all_processed:
            return JSONResponse(status_code=400, content={"detail": "No valid Excel files processed"})

        return JSONResponse(content=all_processed)

    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Error reading Excel files: {str(e)}"})

@router.get("/valid-rows")
def get_valid_rows_only(
    workflow_path: str = Query(..., description="Subdirectory under server/files containing Excel files"),
    db: Session = Depends(get_db),
):
    cleaned_dir = workflow_path.strip('"/')

    records = db.query(Document).filter(Document.workflow_path == workflow_path).all()

    if not records:
        return JSONResponse(status_code=404, content={"detail": f"No records found for workflow_path '{cleaned_dir}'"})

    combined_data = []

    try:
        for record in records:
            if not record.json_data:
                continue
            try:
                parsed = json.loads(record.json_data)
                # parsed can be a list (single file) or a dict of files
                if isinstance(parsed, list):
                    combined_data.extend(parsed)
                elif isinstance(parsed, dict):
                    for value in parsed.values():
                        # check if value is a list or dict
                        if isinstance(value, list):
                            combined_data.extend(value)
                        elif isinstance(value, dict):
                            combined_data.extend(value.get("original_data", []))
            except Exception as e:
                continue  # skip records with invalid JSON

        if not combined_data:
            return JSONResponse(status_code=404, content={"detail": "No valid json_data found in any records."})

        if not combined_data:
            return JSONResponse(status_code=404, content={"detail": "No valid json_data found in any records."})

        # ✅ Convert to DataFrame and process DPD
        df = pd.DataFrame(combined_data)

        if "report_date" in df.columns and "dpd" in df.columns:
            df["report_date"] = pd.to_datetime(df["report_date"], errors="coerce", dayfirst=True)
            df["dpd"] = pd.to_numeric(df["dpd"], errors="coerce").fillna(0)
            df = df.dropna(subset=["report_date"])

            # print("Sample raw dpd data:")
            # print(df[["report_date", "dpd"]].head(10))

            grouped = df.groupby("report_date")["dpd"].sum().sort_index()

            #print("📅 Monthly DPD Summary:")
            # for date, total_dpd in grouped.items():
            #     print(f"  {date.strftime('%d/%m/%Y')}: dpd = {int(total_dpd)}")

            total_dpd_all = grouped.sum()
            #print(f"\n📊 TOTAL DPD ACROSS ALL MONTHS: {int(total_dpd_all)}")


        return JSONResponse(content=combined_data)

    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Error processing records: {str(e)}"})
  
@router.get("/consolidated-rows")
def get_consolidated_rows_only(
    workflow_path: str = Query(..., description="Subdirectory under server/files containing Excel files"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    name = "consolidated-rows"
    if not workflow_path:
            return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})
    existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
    if existing:
        # Deserialize json_data before returning
        existing_data = json.loads(existing.json_data)
        return JSONResponse(
                status_code=200,
                content=existing_data
            ) 
    
    cleaned_dir = workflow_path.strip('"/')
    records = db.query(Document).filter(Document.workflow_path == workflow_path).all()

    if not records:
        return JSONResponse(status_code=404, content={"detail": f"No records found for workflow_path '{cleaned_dir}'"})

    combined_data = []

    desired_fields = [
        "report_date", "loan_segment", "cis_number", "pn_number",
        "loan_amount", "outstanding_balance", "amortization", "booking_date", "dpd"
    ]

    try:
        for record in records:
            if not record.json_data:
                continue
            try:
                parsed = json.loads(record.json_data)

                # Flatten dict structure
                if isinstance(parsed, list):
                    rows = parsed
                elif isinstance(parsed, dict):
                    rows = []
                    for file_data in parsed.values():
                        if isinstance(file_data, list):
                            rows.extend(file_data)
                        elif isinstance(file_data, dict):
                            rows.extend(file_data.get("original_data", []))
                else:
                    continue

                # Filter only desired fields per row
                for row in rows:
                    filtered_row = {k: row.get(k) for k in desired_fields}
                    combined_data.append(filtered_row)

            except Exception:
                continue  # skip invalid records

        if not combined_data:
            return JSONResponse(status_code=404, content={"detail": "No valid data found in any records."})

        new_record = Json(
            user_id=current_user.id,
            name="consolidated-rows",
            workflow_path=workflow_path,
            json_data=json.dumps(combined_data)
        )
        db.add(new_record)
        db.commit()

        return JSONResponse(content=combined_data)

    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Error processing records: {str(e)}"})

@router.post("/pivot-dpd")
def pivot_dpd_table(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # 🔹 Step 1: Extract workflow_path and row
        workflow_path = payload.get("workflow_path")
        name = "pivoting"
        row_data = payload.get("row", [])

        if not workflow_path or not isinstance(row_data, list):
            return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

        # 🔹 Step 2: Check if workflow_path already exists in DB
        existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
        if existing:
            # Deserialize json_data before returning
            existing_data = json.loads(existing.json_data)
            return JSONResponse(
                status_code=200,
                content=existing_data
            )

        # 🔹 Step 3: Validate and Prepare Data
        df = pd.DataFrame(row_data)
        if df.empty:
            return JSONResponse(status_code=400, content={"detail": "Payload row is empty"})

        df.replace("", pd.NA, inplace=True)

        required_columns = {"pn_number", "loan_segment", "report_date", "dpd"}
        if not required_columns.issubset(df.columns):
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required columns: {required_columns - set(df.columns)}"}
            )

        # 🔹 Step 4: Process Data
        df["report_date"] = pd.to_datetime(df["report_date"], errors="coerce", infer_datetime_format=True)
        df.dropna(subset=["report_date"], inplace=True)

        unique_dates = df["report_date"].dt.strftime('%Y-%m-%d').drop_duplicates().tolist()
        df["report_date_str"] = pd.Categorical(df["report_date"].dt.strftime('%Y-%m-%d'), categories=unique_dates)

        pivot_df = df.pivot_table(
            index=["pn_number", "loan_segment"],
            columns="report_date_str",
            values="dpd",
            aggfunc="first"
        ).reset_index()

        pivot_df.fillna("NA", inplace=True)

        result = pivot_df.to_dict(orient="records")

        # 🔹 Step 5: Save to DB
        new_record = Json(
            user_id=current_user.id,
            name="pivoting",
            workflow_path=workflow_path,
            json_data=json.dumps(result)
        )
        db.add(new_record)
        db.commit()

        return result

    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Error processing pivot: {str(e)}"})

def dpd_bucket(dpd_value):
    if pd.isna(dpd_value):
        return "NA"
    try:
        dpd = float(dpd_value)
        if dpd == 0:
            return "0"
        elif dpd <= 30:
            return "1"
        elif dpd <= 60:
            return "2"
        elif dpd <= 90:
            return "3"
        else:
            return "4"
    except:
        return "Invalid"


@router.post("/bucket-dpd")
def bucket_dpd_pivoted(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
    ):
    try:
        # 🔹 Step 1: Extract workflow_path and row
        workflow_path = payload.get("workflow_path")
        name = "bucket-dpd"
        row_data = payload.get("row", [])

        if not workflow_path or not isinstance(row_data, list):
            return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

        # 🔹 Step 2: Check if workflow_path already exists in DB
        existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
        if existing:
            # Deserialize json_data before returning
            existing_data = json.loads(existing.json_data)
            return JSONResponse(
                status_code=200,
                content=existing_data
            )

        # 🔹 Step 3: Validate and Prepare Data
        df = pd.DataFrame(row_data)

        if df.empty:
            return JSONResponse(status_code=400, content={"detail": "Payload is empty"})

        required_columns = {"pn_number", "loan_segment", "report_date", "dpd"}
        if not required_columns.issubset(df.columns):
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required columns: {required_columns - set(df.columns)}"}
            )

        # Convert report_date to datetime (without sorting)
        df["report_date"] = pd.to_datetime(df["report_date"], errors="coerce", infer_datetime_format=True)
        df.dropna(subset=["report_date"], inplace=True)

        # Create a string column for pivoting
        df["report_date_str"] = df["report_date"].dt.strftime('%Y-%m-%d')

        # Pivot using the formatted string column
        pivot_df = df.pivot_table(
            index=["pn_number", "loan_segment"],
            columns="report_date_str",
            values="dpd",
            aggfunc="first"
        ).reset_index()

        # Ensure columns are standard strings
        pivot_df.columns.name = None

        # Get date columns dynamically
        date_columns = [col for col in pivot_df.columns if col not in {"pn_number", "loan_segment"}]

        # Apply DPD bucket transformation
        for col in date_columns:
            pivot_df[col] = pd.to_numeric(pivot_df[col], errors="coerce")
            pivot_df[col] = pivot_df[col].apply(dpd_bucket)

        # Print summary
        #print("\n DPD BUCKET SUMMARY PER REPORT DATE:")
        for col in date_columns:
            bucket_counts = pivot_df[col].value_counts(dropna=False).to_dict()
            #print(f"\n {col}:")
            total_accounts = 0
            for bucket in ["0", "1", "2", "3", "4", "NA"]:
                count = bucket_counts.get(bucket, 0)
                #print(f"  Bucket {bucket}: {count} accounts")
                if bucket in ["0", "1", "2", "3", "4"]:
                    total_accounts += count
            #print(f"   Total Accounts (Buckets 0–4): {total_accounts}")

        # ✅ Save the response to Excel without affecting return value
        # output_dir = "generated_excels"
        # os.makedirs(output_dir, exist_ok=True)
        # output_file = os.path.join(output_dir, "bucketed_dpd_pivoted.xlsx")
        # pivot_df.to_excel(output_file, index=False)

        # 🔹 Step 5: Save to DB
        result = pivot_df.to_dict(orient="records")
        new_record = Json(
            user_id=current_user.id,
            name="bucket-dpd",
            workflow_path=workflow_path,
            json_data=json.dumps(result)
        )
        db.add(new_record)
        db.commit()
        return result

    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Error bucketing DPD pivoted values: {str(e)}"})


def dpd_bucket1(dpd_value):
    if pd.isna(dpd_value):
        return "NA"
    try:
        dpd = int(dpd_value)
        if dpd == 0:
            return 0
        elif dpd <= 30:
            return 1
        elif dpd <= 60:
            return 2
        elif dpd <= 90:
            return 3
        else:
            return 4  # DPD > 90 is BAD
    except Exception as e:
        print(f"⚠️ Error in dpd_bucket1 for value: {dpd_value} -> {e}")
        return "Invalid"


@router.post("/bucket-dpd-everbad")
def bucket_dpd_everbad(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
    ):
    try:
        # 🔹 Step 1: Extract workflow_path and row
        workflow_path = payload.get("workflow_path")
        name = "bucket-dpd-everbad"
        row_data = payload.get("row", [])

        if not workflow_path or not isinstance(row_data, list):
            return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

        # 🔹 Step 2: Check if workflow_path already exists in DB
        existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
        if existing:
            # Deserialize json_data before returning
            existing_data = json.loads(existing.json_data)
            return JSONResponse(
                status_code=200,
                content=existing_data
            )

        # 🔹 Step 3: Validate and Prepare Data
        df = pd.DataFrame(row_data)

        if df.empty:
            return JSONResponse(status_code=400, content={"detail": "Payload is empty"})

        required_columns = {"pn_number", "loan_segment", "report_date", "dpd"}
        if not required_columns.issubset(df.columns):
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required columns: {required_columns - set(df.columns)}"}
            )

        # Clean and format
        df.replace(["", None], pd.NA, inplace=True)
        df["report_date"] = pd.to_datetime(df["report_date"], format="%d/%m/%Y", errors="coerce")
        df.dropna(subset=["report_date"], inplace=True)
        df["dpd"] = pd.to_numeric(df["dpd"], errors="coerce")

        # Pivot DPDs by date
        pivot_df = df.pivot_table(
            index=["pn_number", "loan_segment"],
            columns=df["report_date"].dt.strftime('%Y-%m-%d'),
            values="dpd",
            aggfunc="first"
        ).reset_index()

        date_columns = sorted([col for col in pivot_df.columns if col not in {"pn_number", "loan_segment"}])

        # Ensure numeric before applying everbad logic
        for col in date_columns:
            pivot_df[col] = pd.to_numeric(pivot_df[col], errors="coerce")

        # 🔁 Apply everbad rule (bad = >90 → 4)
        for idx, row in pivot_df.iterrows():
            everbad = False
            for col in date_columns:
                val = row[col]
                if pd.isna(val):
                    continue
                try:
                    if val > 90:
                        everbad = True
                        pivot_df.at[idx, col] = 91  # explicitly set to >90
                    elif everbad:
                        # If already everbad, force value to remain >90 (so it buckets to 4)
                        pivot_df.at[idx, col] = 91
                except:
                    continue

        # 🧠 Bucket conversion: convert to 0-4 or NA
        for col in date_columns:
            pivot_df[col] = pivot_df[col].apply(dpd_bucket1)

        # 📊 Summary print
        #print("\n DPD BUCKET SUMMARY PER REPORT DATE (after everbad):")
        # for col in date_columns:
        #     bucket_counts = pivot_df[col].value_counts(dropna=False).to_dict()
        #     print(f" {col}:")
        #     for bucket in [0, 1, 2, 3, 4, "NA", "Invalid"]:
        #         print(f"  Bucket {bucket}: {bucket_counts.get(bucket, 0)}")

        # # 💾 Save to Excel
        # output_folder = "generated_excels"
        # os.makedirs(output_folder, exist_ok=True)
        # excel_file = os.path.join(output_folder, "bucketing.xlsx")
        # pivot_df.to_excel(excel_file, index=False)

        # 🔹 Step 5: Save to DB
        result = pivot_df.to_dict(orient="records")
        new_record = Json(
            user_id=current_user.id,
            name="bucket-dpd-everbad",
            workflow_path=workflow_path,
            json_data=json.dumps(result)
        )
        db.add(new_record)
        db.commit()
        return result

    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Error: {str(e)}"})


def get_all_dates(payload: List[Dict[str, Any]]) -> List[str]:
    if not payload:
        return []
    all_keys = list(payload[0].keys())
    return sorted([k for k in all_keys if k not in {"pn_number"}])

@router.post("/calculate-odr")
def calculate_odr(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
    ):
    # 🔹 Step 1: Extract workflow_path and row
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "calculate_odr"
    if not workflow_path or not isinstance(row_data, list):
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

    # 🔹 Step 2: Check if workflow_path already exists in DB
    existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
    if existing:
        # Deserialize json_data before returning
        existing_data = json.loads(existing.json_data)
        return JSONResponse(
            status_code=200,
            content=existing_data
        )

    # 🔹 Step 3: Validate and Prepare Data

    def is_valid_date(s):
        try:
            pd.to_datetime(s)
            return True
        except:
            return False

    def clean_sequence(seq):
        """Applies NA cascade first, then everbad logic."""
        cleaned = []
        na_cascade = False
        ever_bad = False
        for val in seq:
            if na_cascade:
                cleaned.append("NA")
                continue

            if val in [None, '', 'NA']:
                na_cascade = True
                cleaned.append("NA")
                continue

            if ever_bad:
                cleaned.append("4")
                continue

            if val == '4':
                ever_bad = True
                cleaned.append("4")
            else:
                cleaned.append(val)

        return cleaned

    if not row_data:
        return {"error": "Empty payload."}

    all_keys = row_data[0].keys()
    date_keys = sorted([k for k in all_keys if is_valid_date(k)], key=lambda x: pd.to_datetime(x))

    if len(date_keys) < 13:
        return {"error": "Need at least 13 months of data for 12-month ODR window."}

    results = []
    window_size = 12

    for i in range(len(date_keys) - window_size):
        obs = date_keys[i]  # Observation point
        end = date_keys[i + window_size]  # End of performance window
        window_range = date_keys[i:i + window_size + 1]  # Inclusive of end month

        good_accounts = set()
        filtered_good_payload = []

        for row in row_data:
            pn = row.get("pn_number")
            # Create DPD sequence per PN within window
            seq = [str(row.get(k)) if row.get(k) not in [None, ''] else 'NA' for k in window_range]
            cleaned_seq = clean_sequence(seq)

            obs_val = cleaned_seq[0]  # Observation month value

            if obs_val == 'NA':
                continue

            try:
                obs_int = int(obs_val)
                if 0 <= obs_int <= 3:
                    good_accounts.add(pn)
                    # Create a copy of row with cleaned values
                    cleaned_row = dict(row)
                    for idx, k in enumerate(window_range):
                        cleaned_row[k] = cleaned_seq[idx]
                    filtered_good_payload.append(cleaned_row)
            except:
                continue

        good_count = len(good_accounts)

        turned_bad_accounts = set()
        for row in filtered_good_payload:
            pn = row.get("pn_number")
            val = row.get(end)

            if val == '4':
                turned_bad_accounts.add(pn)

        bad_count = len(turned_bad_accounts)
        odr = round((bad_count / good_count) * 100, 2) if good_count > 0 else 0.0

        # print(f"Observation point: {pd.to_datetime(obs).strftime('%d-%m-%Y')} - End of Performance window: {pd.to_datetime(end).strftime('%d-%m-%Y')}")
        # print(f"Number of GOOD accounts: {good_count}")
        # print(f"Number of GOOD that turned BAD at {end}: {bad_count}")
        # print(f"ODR: {odr:.2f}%\n")

        results.append({
            "Observation point": obs,
            "End of performance window": end,
            "Number of Good": good_count,
            "Number of Good that turned Bad": bad_count,
            "ODR": f"{odr:.2f}%"
        })
    # 🔹 Step 5: Save to DB
    new_record = Json(
            user_id=current_user.id,
            name="calculate_odr",
            workflow_path=workflow_path,
            json_data=json.dumps(results)
        )
    db.add(new_record)
    db.commit()
    return results


@router.post("/migration-matrix")
def migration_matrix(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 🔹 Step 1: Extract workflow_path and row
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "migration-matrix"
    
    if not workflow_path or not isinstance(row_data, list):
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

    # 🔹 Step 2: Check if workflow_path already exists in DB
    existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
    if existing:
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))

    # 🔹 Step 3: Validate and Prepare Data
    df = pd.DataFrame(row_data)

    date_cols = [col for col in df.columns if col not in ["pn_number", "loan_segment"]]
    date_cols_sorted = sorted(date_cols, key=pd.to_datetime)

    if len(date_cols_sorted) < 2:
        return {"error": "Payload must contain at least two date columns"}

    all_buckets = ["0", "1", "2", "3", "4"]
    output = []

    def map_dpd_bucket(dpd_val: str):
        mapping = {
            "0": "0 DPD_0",
            "1": "1-30 DPD_1",
            "2": "31-60 DPD_2",
            "3": "61-90 DPD_3",
            "4": "91+ DPD_4"
        }
        return mapping.get(dpd_val, "Indeterminate_NA")

    def format_date(date_str: str):
        try:
            return pd.to_datetime(date_str).strftime("%m/%d/%Y")
        except:
            return date_str

    # 🔹 Step 4: Loop over adjacent date pairs
    for i in range(len(date_cols_sorted) - 1):
        from_col = date_cols_sorted[i]
        to_col = date_cols_sorted[i + 1]

        df[from_col] = df[from_col].astype(str)
        df[to_col] = df[to_col].astype(str)

        step_result = []

        for from_bucket in all_buckets:
            filtered = df[df[from_col] == from_bucket]

            row = {
                f"{format_date(from_col)}": len(filtered),
                f"{format_date(to_col)}_Bucket": int(from_bucket),
                "0 DPD_0": 0,
                "1-30 DPD_1": 0,
                "31-60 DPD_2": 0,
                "61-90 DPD_3": 0,
                "91+ DPD_4": 0,
                "Indeterminate_NA": 0,
            }

            for _, account in filtered.iterrows():
                dpd_to = str(account[to_col])
                key = map_dpd_bucket(dpd_to)
                row[key] += 1

            row["Total Accounted Evaluated"] = (
                row["0 DPD_0"]
                + row["1-30 DPD_1"]
                + row["31-60 DPD_2"]
                + row["61-90 DPD_3"]
                + row["91+ DPD_4"]
            )

            step_result.append(row)

        output.append(step_result)

    # 🔹 Step 5: Save result to DB
    new_record = Json(
        user_id=current_user.id,
        name=name,
        workflow_path=workflow_path,
        json_data=json.dumps(output)
    )
    db.add(new_record)
    db.commit()

    return output

def get_bucket(dpd):
    if pd.isna(dpd) or dpd == "NA":
        return "NA"
    try:
        bucket = int(dpd)
        if bucket == 0:
            return "0"
        elif bucket == 1:
            return "1"
        elif bucket == 2:
            return "2"
        elif bucket == 3:
            return "3"
        elif bucket == 4:
            return "4"
        else:
            return "NA"
    except:
        return "NA"

@router.post("/migration-matrix-percentage")
def migration_matrix_percentage(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 🔹 Step 1: Extract workflow_path and row
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "migration_matrix_percentage"

    if not workflow_path or not isinstance(row_data, list):
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

    # 🔹 Step 2: Check if workflow_path already exists in DB
    existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
    if existing:
        existing_data = json.loads(existing.json_data)
        return JSONResponse(status_code=200, content=existing_data)

    # 🔹 Step 3: Validate and Prepare Data
    if not row_data:
        return []
    df = pd.DataFrame(row_data)
    date_cols = [col for col in df.columns if col not in ["pn_number", "loan_segment"]]
    if len(date_cols) < 2:
        return {"error": "Need at least two dates to calculate migration."}

    date_cols = sorted(date_cols, key=lambda x: pd.to_datetime(x))

    grouped_results = []

    for i in range(len(date_cols) - 1):
        from_date = date_cols[i]
        to_date = date_cols[i + 1]
        df["from_bucket"] = df[from_date].apply(get_bucket)
        df["to_bucket"] = df[to_date].apply(get_bucket)

        transition_group = []

        for source_bucket in ["0", "1", "2", "3", "4"]:
            filtered = df[df["from_bucket"] == source_bucket]
            valid_filtered = filtered[filtered["to_bucket"].isin(["0", "1", "2", "3", "4"])]

            total_accounts = len(valid_filtered)
            transition_counts = defaultdict(int)

            for _, row in filtered.iterrows():
                to_b = row["to_bucket"]
                if to_b == "0":
                    transition_counts["0 DPD_0"] += 1
                elif to_b == "1":
                    transition_counts["1-30 DPD_1"] += 1
                elif to_b == "2":
                    transition_counts["31-60 DPD_2"] += 1
                elif to_b == "3":
                    transition_counts["61-90 DPD_3"] += 1
                elif to_b == "4":
                    transition_counts["91+ DPD_4"] += 1
                elif to_b == "NA":
                    transition_counts["Indeterminate_NA"] += 1

            if total_accounts > 0:
                result_row = {
                    from_date: "",
                    f"{to_date}_Bucket": int(source_bucket),
                    "0 DPD_0": round(transition_counts["0 DPD_0"] / total_accounts, 4),
                    "1-30 DPD_1": round(transition_counts["1-30 DPD_1"] / total_accounts, 4),
                    "31-60 DPD_2": round(transition_counts["31-60 DPD_2"] / total_accounts, 4),
                    "61-90 DPD_3": round(transition_counts["61-90 DPD_3"] / total_accounts, 4),
                    "91+ DPD_4": round(transition_counts["91+ DPD_4"] / total_accounts, 4),
                    "Indeterminate_NA": round(transition_counts["Indeterminate_NA"] / total_accounts, 4),
                    "Total Accounted Evaluated": "100%"
                }
            else:
                result_row = {
                    from_date: "",
                    f"{to_date}_Bucket": int(source_bucket),
                    "0 DPD_0": 0,
                    "1-30 DPD_1": 0,
                    "31-60 DPD_2": 0,
                    "61-90 DPD_3": 0,
                    "91+ DPD_4": 0,
                    "Indeterminate_NA": 0,
                    "Total Accounted Evaluated": "100%"
                }

            transition_group.append(result_row)

        grouped_results.append(transition_group)

    # 🔹 Step 5: Save to DB
    new_record = Json(
        user_id=current_user.id,
        name=name,
        workflow_path=workflow_path,
        json_data=json.dumps(grouped_results)
    )
    db.add(new_record)
    db.commit()

    return grouped_results

@router.post("/migration-matrix-average-final")
def calculate_bucket_matrix_average(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
    ):
    # 🔹 Step 1: Extract workflow_path and row
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "migration_matrix_average"
    if not workflow_path or not isinstance(row_data, list):
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

    # 🔹 Step 2: Check if workflow_path already exists in DB
    existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
    if existing:
        # Deserialize json_data before returning
        print("existing record found, returning existing data")
        existing_data = json.loads(existing.json_data)
        return JSONResponse(
            status_code=200,
            content=existing_data
        )

    # 🔹 Step 3: Validate and Prepare Data
    if not row_data:
        return []
    df = pd.DataFrame(row_data)

    bucket_cols = [col for col in df.columns if col.endswith("_Bucket")]
    dpd_cols = [col for col in df.columns if "DPD" in col]

    all_rows = []
    for bucket_col in bucket_cols:
        temp_df = df[[bucket_col] + dpd_cols].copy()
        temp_df = temp_df.rename(columns={bucket_col: "Bucket"})
        temp_df["Report_Month"] = bucket_col.replace("_Bucket", "")
        all_rows.append(temp_df)

    merged_df = pd.concat(all_rows)
    merged_df = merged_df.dropna(subset=["Bucket"])
    merged_df["Bucket"] = merged_df["Bucket"].astype(int)

    # Step 3: Print all '0 DPD_0' values from Bucket 0 per month
    print("All '0 DPD_0' values from Bucket 0 per month:")
    all_0_dpd_values = []
    for month in merged_df["Report_Month"].unique():
        subset = merged_df[(merged_df["Report_Month"] == month) & (merged_df["Bucket"] == 0)]
        values = subset["0 DPD_0"].dropna().tolist()
        all_0_dpd_values.extend(values)
        print(f"Month: {month}, Bucket: 0, '0 DPD_0' values: {values}")

    # Step 4: Compute average of DPD values per bucket
    print("\nAverage of DPD values per bucket:")
    average_results = {}
    total_0_dpd = sum(all_0_dpd_values)
    total_count_0_dpd = len(all_0_dpd_values)

    for bucket in merged_df["Bucket"].unique():
        bucket_values = {}
        for col in dpd_cols:
            bucket_values[col] = {
                "sum": 0,
                "count": 0
            }

        for month in merged_df["Report_Month"].unique():
            month_df = merged_df[(merged_df["Report_Month"] == month) & (merged_df["Bucket"] == bucket)]
            if not month_df.empty:
                for col in dpd_cols:
                    value = month_df[col].sum()
                    count = month_df[col].count()
                    bucket_values[col]["sum"] += value
                    bucket_values[col]["count"] += count

        # Calculate averages and totals
        for col in dpd_cols:
            avg = bucket_values[col]["sum"] / bucket_values[col]["count"] if bucket_values[col]["count"] > 0 else 0
            average_results.setdefault(bucket, {})[col] = avg

            print(f"Bucket {bucket}, {col}: average = {round(avg, 2)}%")

    # Step 5: Format final output
    final_result = []
    for from_bucket in sorted(average_results.keys()):
        row = {"Bucket": int(from_bucket)}
        total = 0
        for col in dpd_cols:
            rounded_val = round(average_results[from_bucket].get(col, 0), 2)
            row[col] = rounded_val
            total += rounded_val
        row["Total"] = round(total, 2)
        final_result.append(row)

    # 🔹 Step 6: Save to DB
    new_record = Json(
        user_id=current_user.id,
        name="migration_matrix_average",
        workflow_path=workflow_path,
        json_data=json.dumps(final_result)
    )
    db.add(new_record)
    db.commit()

    return final_result

@router.get("/get-migration-matrix-average")
def get_migration_matrix_average(workflow_path: str = Query(..., description="Subdirectory under server/files containing Excel files"),
    db: Session = Depends(get_db)):
    # 🔹 Step 1: Check if workflow_path already exists in D
    name = "migration_matrix_average"
    print(workflow_path)
    # 🔹 Step 2: Check if workflow_path already exists in DB
    existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
    if existing:
        # Deserialize json_data before returning
        print("existing record found, returning existing data")
        existing_data = json.loads(existing.json_data)
        return JSONResponse(
            status_code=200,
            content=existing_data
        )
    else:
        return JSONResponse(
            status_code=404,
            content={"detail": f"No migration matrix average found for workflow_path: {workflow_path}"}
        )

@router.post("/migration-matrix-12months")
def calculate_12_month_transition_matrix(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "12month_transition_matrix"

    if not workflow_path or not isinstance(row_data, list):
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path' or invalid 'row' format"})

    existing = db.query(Json).filter(Json.workflow_path == workflow_path, Json.name == name).first()
    if existing:
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))

    if not row_data:
        return []

    # Correct column names with standard hyphen
    dpd_cols = ["0 DPD_0", "1-30 DPD_1", "31-60 DPD_2", "61-90 DPD_3", "91+ DPD_4"]

    df = pd.DataFrame(row_data).sort_values("Bucket").reset_index(drop=True)

    # Safety check: all dpd columns must exist
    if not all(col in df.columns for col in dpd_cols):
        return JSONResponse(status_code=400, content={"detail": "Missing one or more DPD columns in data"})

    # Convert to numpy matrix with float values (probabilities)
    matrix = df[dpd_cols].to_numpy(dtype=float)

    # Ensure matrix is square
    if matrix.shape[0] != matrix.shape[1]:
        return JSONResponse(status_code=400, content={"detail": "Transition matrix must be square"})

    result_list = []
    for month in range(1, 13):
        powered_matrix = np.linalg.matrix_power(matrix, month)
        powered_matrix = np.round(powered_matrix, 4)
        for i, row_vals in enumerate(powered_matrix):
            result = {
                "Month": f"Month {month}",
                "Bucket": int(df.loc[i, "Bucket"])
            }
            total = 0
            for j, col_name in enumerate(dpd_cols):
                val = float(row_vals[j])
                result[col_name] = round(val, 4)
                total += val
            result["Total"] = round(total, 4)
            result_list.append(result)

    # Save to DB
    new_record = Json(
        user_id=current_user.id,
        name=name,
        workflow_path=workflow_path,
        json_data=json.dumps(result_list)
    )
    db.add(new_record)
    db.commit()

    return result_list


def flatten_nested_list(data):
    """Flatten nested list of lists into a single list."""
    if not isinstance(data, list):
        return [data]
    flattened = []
    for item in data:
        if isinstance(item, list):
            flattened.extend(flatten_nested_list(item))
        else:
            flattened.append(item)
    return flattened

def flatten_dict(d):
    # Your existing flatten dict function here
    # If you don't have one, just return d as is
    return d

@router.post("/download-excel")
def download_excel(payload: dict = Body(...)):
    data = payload.get("data", None)
    if data is None:
        return {"error": "Missing 'data' in payload."}

    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        if isinstance(data, list):
            # flatten nested lists to one list of dicts
            flattened_data = flatten_nested_list(data)
            flattened_data = [flatten_dict(item) for item in flattened_data]
            df = pd.DataFrame(flattened_data)
            df.to_excel(writer, index=False, sheet_name="Sheet1")

        elif isinstance(data, dict):
            for sheet_name, sheet_data in data.items():
                if isinstance(sheet_data, list):
                    flattened_data = flatten_nested_list(sheet_data)
                    flattened_data = [flatten_dict(item) for item in flattened_data]
                    df = pd.DataFrame(flattened_data)
                    safe_sheet_name = sheet_name[:31]
                    df.to_excel(writer, index=False, sheet_name=safe_sheet_name)
                else:
                    # If sheet_data is a dict (like your matrixByMonth maybe)
                    if isinstance(sheet_data, dict):
                        # flatten dict of lists into concatenated list of dicts
                        all_items = []
                        for key, val in sheet_data.items():
                            if isinstance(val, list):
                                all_items.extend(flatten_nested_list(val))
                            else:
                                all_items.append(val)
                        all_items = [flatten_dict(item) for item in all_items]
                        df = pd.DataFrame(all_items)
                        safe_sheet_name = sheet_name[:31]
                        df.to_excel(writer, index=False, sheet_name=safe_sheet_name)
                    else:
                        return {
                            "error": f"Expected list or dict for sheet '{sheet_name}', got {type(sheet_data).__name__}"
                        }
        else:
            return {"error": "Invalid data format. Expected list or dict under 'data' key."}

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=valid_rows.xlsx"},
    )


def reorder_columns(df, cols_order):
    # Reorder columns in df, adding missing cols as empty if needed
    for col in cols_order:
        if col not in df.columns:
            df[col] = ""
    return df[cols_order]

@router.post("/download-excel-v2")
def download_excel(payload: dict = Body(...)):
    data = payload.get("data")
    if data is None:
        return {"error": "Missing 'data' in payload."}

    output = BytesIO()

    avg_cols = ["Bucket", "0 DPD_0", "1-30 DPD_1", "31-60 DPD_2", "61-90 DPD_3", "91+ DPD_4", "Total"]
    data_static_cols = [
        "0 DPD_0",
        "1-30 DPD_1",
        "31-60 DPD_2",
        "61-90 DPD_3",
        "91+ DPD_4",
        "Indeterminate_NA",
        "Total Accounted Evaluated",
    ]
    perc_static_cols = [
        "0 DPD_0",
        "1-30 DPD_1",
        "31-60 DPD_2",
        "61-90 DPD_3",
        "91+ DPD_4",
        "Indeterminate_NA",
        "Total Accounted Evaluated",
    ]

    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        # 1) migrationMatrixAverage - single sheet
        avg_data = data.get("migrationMatrixAverage", [])
        if avg_data:
            df_avg = pd.DataFrame(avg_data)
            df_avg = reorder_columns(df_avg, avg_cols)
            df_avg.to_excel(writer, index=False, sheet_name="migrationMatrixAverage")

        # 2) migrationMatrixData - multiple sheets, one per inner list
        migration_data = data.get("migrationMatrixData", [])
        for i, inner_list in enumerate(migration_data):
            flattened_data = flatten_nested_list(inner_list)
            if flattened_data:
                df_data = pd.DataFrame(flattened_data)

                date_cols = [col for col in df_data.columns if ("/" in col or "-" in col) and (col.endswith("_Bucket") or True)]
                known_cols = set(data_static_cols)
                date_cols = [c for c in date_cols if c not in known_cols]

                data_cols_order = ["0 DPD_0"] + sorted(date_cols) + data_static_cols[1:]
                df_data = reorder_columns(df_data, data_cols_order)

                # Limit sheet name length (max 31 chars in Excel)
                sheet_name = f"migrationMatrixData_{i+1}"
                if len(sheet_name) > 31:
                    sheet_name = sheet_name[:31]
                df_data.to_excel(writer, index=False, sheet_name=sheet_name)

        # 3) migrationMatrixPercentage - multiple sheets, one per inner list
        migration_perc = data.get("migrationMatrixPercentage", [])
        for i, inner_list in enumerate(migration_perc):
            flattened_perc = flatten_nested_list(inner_list)
            if flattened_perc:
                df_perc = pd.DataFrame(flattened_perc)

                date_cols_perc = [col for col in df_perc.columns if ("/" in col or "-" in col) and (col.endswith("_Bucket") or True)]
                known_perc_cols = set(perc_static_cols)
                date_cols_perc = [c for c in date_cols_perc if c not in known_perc_cols]

                perc_cols_order = perc_static_cols[:-2] + sorted(date_cols_perc) + perc_static_cols[-2:]
                df_perc = reorder_columns(df_perc, perc_cols_order)

                sheet_name = f"migrationMatrixPercentage_{i+1}"
                if len(sheet_name) > 31:
                    sheet_name = sheet_name[:31]
                df_perc.to_excel(writer, index=False, sheet_name=sheet_name)

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=migration_matrix.xlsx"},
    )






