from typing import List, Optional
import json
import os
import pathlib
import numpy as np
import pandas as pd
import math
import traceback

from collections import defaultdict, Counter
from schemas.schemas import DocumentResponse, DocumentCreate , JsonCreate
from models.models import User
from database import get_db
from helpers.document import get_documents, create_document, delete_document
from core.security import get_current_user
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Body, Query, Response
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from pathlib import Path
from datetime import datetime
from io import BytesIO
from typing import List, Dict, Any, Tuple, DefaultDict
from decimal import Decimal, InvalidOperation
from models.models import Document, JsonData
from sqlalchemy import func, and_, desc
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


@router.options("/workflows/check")
def options_workflow_exists() -> Response:
    # CORS middleware will still inject the right headers.
    # We just return 200 so the preflight always passes.
    return Response(status_code=status.HTTP_200_OK)


# 2) Your existing GET handler, unchanged logic but with debug logs
@router.get("/workflows/check")
def check_workflow_exists(
    entity: str = Query(..., description="Entity name, e.g., BanKo"),
    loan_product: str = Query("", description="Loan product, e.g., Home"),
    reporting_period: str = Query(..., description="Reporting period, e.g., Monthly"),
    report_date_start: str = Query(
        "", description="Report start date, e.g., 2025-11-21"
    ),
    workflow_name: str = Query(..., description="Workflow name, e.g., asa1a2"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # MUST match the same pattern as in create_user_workflow
    print("test")
    workflow_path = (
        f"/{entity}"
        f"/{reporting_period}"
        f"/{workflow_name}"
        f"/{loan_product}"
    )
    print("test")
    print("[check_workflow_exists] user_id:", current_user.id)
    print("[check_workflow_exists] workflow_path:", workflow_path)

    doc = (
        db.query(Document)
        .filter(
            Document.workflow_path == workflow_path,
            Document.user_id == current_user.id,
        )
        .first()
    )

    print("[check_workflow_exists] found doc:", doc)

    return {"exists": doc is not None}
@router.get("/workflows/files", response_model=List[str])
def list_excel_files(
    entity: str = Query(...),
    reporting_period: str = Query(...),
    workflow_name: str = Query(...),
    loan_product: str = Query(...),
    report_date_start: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow_path = (
        f"/{entity}/"
        f"{loan_product}/"
        f"{reporting_period}/"
        f"{report_date_start}/"
        f"{workflow_name}"
    )

    latest_docs_subquery = (
        db.query(
            Document.filename,
            func.max(Document.version).label("latest_version")
        )
        .filter(
            Document.workflow_path == workflow_path,
            Document.user_id == current_user.id
        )
        .group_by(Document.filename)
        .subquery()
    )

    docs = (
        db.query(Document)
        .join(
            latest_docs_subquery,
            (Document.filename == latest_docs_subquery.c.filename) &
            (Document.version == latest_docs_subquery.c.latest_version)
        )
        .filter(
            Document.workflow_path == workflow_path,
            Document.user_id == current_user.id
        )  # apply same filter here
        .all()
    )

    return [
        f"{doc.filename} (v{doc.version})"
        for doc in docs
        if doc.filename.lower().endswith((".xlsx", ".xls")) and doc.version
    ]


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not delete_document(db, document_id=document_id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Document not found")
    return None

def try_parse_date(v) -> Tuple[pd.Timestamp | None, str | None]:
    if pd.isna(v) or v is None or (isinstance(v, str) and v.strip() == ""):
        return None, None

    if isinstance(v, (pd.Timestamp, datetime)):
        ts = pd.to_datetime(v)
        return ts, ts.strftime("%Y-%m-%d")

    s = str(v).strip()
    formats = [
        "%Y-%m-%d",
        "%Y-%m",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return pd.to_datetime(dt), dt.strftime("%Y-%m-%d")
        except Exception:
            continue

    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.isna(dt):
            return None, None
        return dt, dt.strftime("%Y-%m-%d")
    except Exception:
        return None, None




def sanitize_for_json(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    def clean_value(v):
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        if isinstance(v, (pd.Timestamp, datetime)):
            return v.strftime("%d/%m/%Y")
        return v
    return {k: clean_value(v) for k, v in row_dict.items()}


def try_parse_date(v) -> Tuple[pd.Timestamp | None, str | None]:
    if pd.isna(v) or v is None or (isinstance(v, str) and v.strip() == ""):
        return None, None

    if isinstance(v, (pd.Timestamp, datetime)):
        ts = pd.to_datetime(v)
        return ts, ts.strftime("%Y-%m-%d")

    s = str(v).strip()
    formats = [
        "%Y-%m-%d",
        "%Y-%m",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return pd.to_datetime(dt), dt.strftime("%Y-%m-%d")
        except Exception:
            continue

    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.isna(dt):
            return None, None
        return dt, dt.strftime("%Y-%m-%d")
    except Exception:
        return None, None


@router.get("/read-excel")
def read_single_excel(
    workflow_path: str = Query(..., description="Subdirectory under server/files containing Excel files"),
    db: Session = Depends(get_db),
):
    base_dir = Path(__file__).parents[2] / "files"
    cleaned_path = workflow_path.strip('"/')
    excel_dir = base_dir / cleaned_path

    records = db.query(Document).filter(Document.workflow_path == workflow_path).all()
    if not records:
        return JSONResponse(status_code=404, content={"detail": f"No records found for workflow_path '{cleaned_path}'"})

    if not excel_dir.exists() or not excel_dir.is_dir():
        return JSONResponse(status_code=404, content={"detail": f"Directory not found: {excel_dir}"})

    excel_files = [f for f in excel_dir.iterdir() if f.is_file() and f.suffix.lower() in (".xlsx", ".xls")]
    if not excel_files:
        return JSONResponse(status_code=404, content={"detail": "No Excel files found in directory"})

    # Columns you specified as required for "missing" classification
    required_columns = [
        "report_date", "loan_segment", "cis_number", "pn_number",
        "loan_amount", "outstanding_balance", "amortization", "booking_date",
        "maturity_date", "eir", "monthly_payments", "dpd"
    ]

    all_processed = []

    try:
        for file_path in excel_files:
            df = pd.read_excel(file_path, engine="openpyxl", dtype=object)

            # normalize headers
            df.columns = [str(c).strip().lower() for c in df.columns]

            # keep NaN as-is for pd.isna checks; we still remove infs
            df.replace([np.inf, -np.inf], np.nan, inplace=True)

            original_records = df.to_dict(orient="records")
            safe_original = [sanitize_for_json(row) for row in original_records]

            matching_record = next((r for r in records if r.filename == file_path.name), None)
            if matching_record:
                matching_record.json_data = json.dumps(safe_original)

            # quick header check
            missing_cols = [col for col in required_columns if col not in df.columns]
            if missing_cols:
                all_processed.append({
                    "filename": file_path.name,
                    "valid": 0,
                    "missing": 0,
                    "error": 0,
                    "rows": [],
                    "note": f"Missing columns in file header: {missing_cols}"
                })
                continue

            # if file has no rows (empty sheet), report and continue
            if df.shape[0] == 0:
                all_processed.append({
                    "filename": file_path.name,
                    "valid": 0,
                    "missing": 0,
                    "error": 0,
                    "rows": [],
                    "note": "File is empty (no rows)"
                })
                continue

            # helper to convert numeric-like strings to Decimal (return value + raw)
            def to_decimal_with_raw(x):
                raw = x
                try:
                    if x is None or pd.isna(x):
                        return None, raw
                    # If already a Decimal or int, convert safely
                    if isinstance(x, Decimal):
                        return x, raw
                    if isinstance(x, int):
                        return Decimal(x), raw
                    # strip commas and whitespace; handle strings like "0", "0.0", "1,234.56"
                    s = str(x).replace(",", "").strip()
                    if s == "":
                        return None, raw
                    return Decimal(s), raw
                except (InvalidOperation, Exception):
                    return None, raw

            intermediate_rows: List[Dict[str, Any]] = []
            dup_keys: List[tuple] = []

            # iterate using required_columns to build focused rows
            for idx, row in df[required_columns].iterrows():
                raw_row = {col: row.get(col) for col in required_columns}
                row_out: Dict[str, Any] = raw_row.copy()  # we'll add meta fields here
                row_out["source_file"] = file_path.name
                row_out["error_explanations"] = []  # human-readable explanation list
                row_out["errors"] = []              # compact error codes (kept for programmatic use)
                row_out["missing_fields"] = []

                # --- Missing check: which required fields are empty? ---
                for col in required_columns:
                    val = raw_row.get(col)
                    # treat NaN/None or whitespace-only strings as missing
                    if pd.isna(val) or (isinstance(val, str) and val.strip() == ""):
                        row_out["missing_fields"].append(col)

                if row_out["missing_fields"]:
                    row_out["status"] = "missing"
                    row_out["error_explanations"].append(
                        f"Missing required fields: {', '.join(row_out['missing_fields'])}"
                    )
                    intermediate_rows.append(row_out)
                    continue

                # otherwise start as valid
                row_out["status"] = "valid"

                # --- Date parsing checks with detailed messages ---
                for date_col in ("report_date", "booking_date", "maturity_date"):
                    raw_val = raw_row.get(date_col)
                    parsed, norm = try_parse_date(raw_val)
                    if parsed is None:
                        code = f"invalid_date_format:{date_col}"
                        row_out["errors"].append(code)
                        row_out["error_explanations"].append(
                            f"Unparsable date in '{date_col}': original value = {repr(raw_val)}. Expected formats: YYYY-MM-DD, YYYY-MM, DD/MM/YYYY, MM/DD/YYYY, etc."
                        )
                        row_out["status"] = "error"
                    else:
                        row_out[f"{date_col}_parsed"] = parsed.strftime("%Y-%m-%d")

                # --- Numeric parsing with Decimal (no float conversion) ---
                dpd_val, dpd_raw = to_decimal_with_raw(raw_row.get("dpd"))
                amort_val, amort_raw = to_decimal_with_raw(raw_row.get("amortization"))
                monthly_pay_val, monthly_pay_raw = to_decimal_with_raw(raw_row.get("monthly_payments"))

                if dpd_val is None:
                    row_out["errors"].append("numeric_parse:dpd")
                    row_out["error_explanations"].append(f"Could not parse numeric field 'dpd' (raw value: {repr(dpd_raw)})")
                    row_out["status"] = "error"
                if amort_val is None:
                    row_out["errors"].append("numeric_parse:amortization")
                    row_out["error_explanations"].append(f"Could not parse numeric field 'amortization' (raw value: {repr(amort_raw)})")
                    row_out["status"] = "error"
                if monthly_pay_val is None:
                    row_out["errors"].append("numeric_parse:monthly_payments")
                    row_out["error_explanations"].append(f"Could not parse numeric field 'monthly_payments' (raw value: {repr(monthly_pay_raw)})")
                    row_out["status"] = "error"

                # --- Payment consistency check (flag only — DO NOT CORRECT) using Decimal ==
                try:
                    if dpd_val is not None and dpd_val == Decimal(0):
                        if amort_val is not None and monthly_pay_val is not None and monthly_pay_val != amort_val:
                            row_out["errors"].append("payment_mismatch_dpd_0")
                            row_out["error_explanations"].append(
                                f"DPD is 0 but monthly_payments ({monthly_pay_raw}) != amortization ({amort_raw}). Expected payment equal to amortization when DPD=0."
                            )
                            row_out["status"] = "error"
                except Exception:
                    row_out["errors"].append("payment_consistency_check_failed")
                    row_out["error_explanations"].append("Payment consistency check failed due to unexpected error.")
                    row_out["status"] = "error"

                # Save canonical key for duplicate detection (use parsed report_date if available)
                rep_norm = row_out.get("report_date_parsed") or str(row_out.get("report_date"))
                cis = str(row_out.get("cis_number")).strip() if row_out.get("cis_number") is not None else ""
                pn = str(row_out.get("pn_number")).strip() if row_out.get("pn_number") is not None else ""
                dup_keys.append((rep_norm, cis, pn))

                intermediate_rows.append(row_out)

            # Duplicate detection within file
            from collections import Counter, defaultdict
            dup_counter = Counter(dup_keys)
            duplicates_found = {k: v for k, v in dup_counter.items() if v > 1}

            # annotate duplicates and add explanations
            if duplicates_found:
                group_positions: DefaultDict[tuple, int] = defaultdict(int)
                for row in intermediate_rows:
                    rep_norm = row.get("report_date_parsed") or str(row.get("report_date"))
                    cis = str(row.get("cis_number")).strip() if row.get("cis_number") is not None else ""
                    pn = str(row.get("pn_number")).strip() if row.get("pn_number") is not None else ""
                    key = (rep_norm, cis, pn)
                    if key in duplicates_found:
                        row["duplicate"] = True
                        row["duplicate_count"] = int(duplicates_found[key])
                        row["errors"].append("duplicate_cis_pn_for_report_date")
                        row["error_explanations"].append(
                            f"Duplicate records found for (report_date={rep_norm}, cis_number={cis}, pn_number={pn}). Occurrences: {duplicates_found[key]}."
                        )
                        group_positions[key] += 1
                        row["group_sequence"] = group_positions[key]

            # Now compute file-level ordering sequence (row_sequence) and precise group_sequence
            ordering = []
            for i, row in enumerate(intermediate_rows):
                rep_norm = row.get("report_date_parsed") or str(row.get("report_date"))
                cis = str(row.get("cis_number")).strip() if row.get("cis_number") is not None else ""
                pn = str(row.get("pn_number")).strip() if row.get("pn_number") is not None else ""
                ordering.append((i, rep_norm or "", cis or "", pn or ""))

            ordering_sorted = sorted(ordering, key=lambda t: (t[1], t[2], t[3]))

            for seq, (orig_index, *_rest) in enumerate(ordering_sorted, start=1):
                intermediate_rows[orig_index]["row_sequence"] = int(seq)

            if duplicates_found:
                group_counters: DefaultDict[tuple, int] = defaultdict(int)
                for orig_index, rep_norm, cis, pn in [(t[0], t[1], t[2], t[3]) for t in ordering_sorted]:
                    key = (rep_norm, cis, pn)
                    if key in duplicates_found:
                        group_counters[key] += 1
                        intermediate_rows[orig_index]["group_sequence"] = int(group_counters[key])
                    else:
                        intermediate_rows[orig_index]["group_sequence"] = 1

            # finalize and sanitize processed_rows for JSON output
            processed_rows = [sanitize_for_json(r) for r in intermediate_rows]

            # build per-pn summary for payment_mismatch_dpd_0 (and include cis + report_date)
            seen = set()
            flagged_pn_summary = []
            for r in processed_rows:
                errors = r.get("errors") or []
                if "payment_mismatch_dpd_0" in errors:
                    rep = r.get("report_date_parsed") or r.get("report_date")
                    pn = r.get("pn_number")
                    cis = r.get("cis_number")
                    key = (rep, pn)
                    if key not in seen:
                        seen.add(key)
                        flagged_pn_summary.append({
                            "report_date": rep,
                            "pn_number": pn,
                            "cis_number": cis,
                            "reason": "DPD is 0 but monthly_payments != amortization for this pn_number",
                            "occurrences": sum(1 for x in processed_rows if (x.get("report_date_parsed") or x.get("report_date")) == rep and x.get("pn_number") == pn and ("payment_mismatch_dpd_0" in (x.get("errors") or [])))
                        })

            total_rows = len(processed_rows)
            missing_count = sum(1 for r in processed_rows if r.get("status") == "missing")
            valid_count = sum(1 for r in processed_rows if r.get("status") == "valid")
            error_count = total_rows - (valid_count + missing_count)

            all_processed.append({
                "filename": file_path.name,
                "valid": int(valid_count),
                "missing": int(missing_count),
                "error": int(error_count),
                "rows": processed_rows,
                "flagged_pn_summary": flagged_pn_summary
            })

        db.commit()

        if not all_processed:
            return JSONResponse(status_code=400, content={"detail": "No valid Excel files processed"})

        return JSONResponse(content=all_processed)

    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Error reading Excel files: {str(e)}"})


@router.post("/insert-new-version")
def insert_new_document(
    payload: Dict[str, Any],
        current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    try:
        workflow = payload.get("workflow")
        filename = payload.get("filename")
        updated_data = payload.get("updatedData")
        if not workflow or not filename or updated_data is None:
            raise HTTPException(status_code=400, detail="workflow, filename, and updatedData are required")

       # Get the maximum version for the same workflow_path, filename, and user_id
        docs = (
            db.query(Document)
            .filter(
                Document.workflow_path == workflow,
                Document.user_id == current_user.id
            )
            .order_by(Document.version.desc())  # latest version first
            .first()  # get a single latest record
        )
        print(docs.version)
        # Increment version by 1 for the new record
        version = docs.version + 1

        # Create new record
        new_doc = Document(
            workflow_path=workflow,
            filename=filename,
            json_data=json.dumps(updated_data),
             user_id=current_user.id,
            version=version
        )

        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)

        return {
            "message": "Document inserted successfully",
            "id": new_doc.id,
            "filename": new_doc.filename,
            "workflow_path": new_doc.workflow_path,
            "version": new_doc.version
        }

    except HTTPException as he:
        # re-raise HTTPExceptions to propagate proper status
        raise he
    except Exception as e:
        # catch-all for unexpected errors
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error inserting document: {str(e)}")

@router.get("/valid-rows")
def get_valid_rows_only(
    workflow_path: str = Query(..., description="Subdirectory under server/files containing Excel files"),
    db: Session = Depends(get_db),
):
    cleaned_dir = workflow_path.strip('"/')

    latest_docs_subquery = (
        db.query(
            Document.workflow_path,
            Document.user_id,
            Document.filename,
            func.max(Document.version).label("max_version")
        )
        .filter(Document.workflow_path == workflow_path)
        .group_by(Document.workflow_path, Document.user_id, Document.filename)
        .subquery()
    )

    # Join back to Document to get actual rows
    records = (
        db.query(Document)
        .join(
            latest_docs_subquery,
            (Document.workflow_path == latest_docs_subquery.c.workflow_path) &
            (Document.user_id == latest_docs_subquery.c.user_id) &
            (Document.filename == latest_docs_subquery.c.filename) &
            (Document.version == latest_docs_subquery.c.max_version)
        )
        .all()  # must be .all() to make it iterable
    )

    if not records:
        return JSONResponse(status_code=404, content={"detail": f"No records found for workflow_path '{cleaned_dir}'"})

    combined_data = []

    try:
        for record in records:
            if not record.json_data:
                continue
            try:
                parsed = json.loads(record.json_data)
                if isinstance(parsed, list):
                    combined_data.extend(parsed)
                elif isinstance(parsed, dict):
                    for value in parsed.values():
                        if isinstance(value, list):
                            combined_data.extend(value)
                        elif isinstance(value, dict):
                            combined_data.extend(value.get("original_data", []))
            except Exception:
                continue  # skip records with invalid JSON

        if not combined_data:
            return JSONResponse(status_code=404, content={"detail": "No valid json_data found in any records."})

        # Convert to DataFrame and process DPD
        df = pd.DataFrame(combined_data)

        if "report_date" in df.columns and "dpd" in df.columns:
            df["report_date"] = pd.to_datetime(df["report_date"], errors="coerce", dayfirst=True)
            df["dpd"] = pd.to_numeric(df["dpd"], errors="coerce").fillna(0)
            df = df.dropna(subset=["report_date"])
            grouped = df.groupby("report_date")["dpd"].sum().sort_index()
            total_dpd_all = grouped.sum()

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

    cleaned_dir = workflow_path.strip('"/')

    # get latest Document per (workflow_path, user_id, filename)
    latest_docs_subquery = (
        db.query(
            Document.workflow_path,
            Document.user_id,
            Document.filename,
            func.max(Document.version).label("max_version")
        )
        .filter(Document.workflow_path == workflow_path)
        .group_by(Document.workflow_path, Document.user_id, Document.filename)
        .subquery()
    )

    records = (
        db.query(Document)
        .join(
            latest_docs_subquery,
            (Document.workflow_path == latest_docs_subquery.c.workflow_path) &
            (Document.user_id == latest_docs_subquery.c.user_id) &
            (Document.filename == latest_docs_subquery.c.filename) &
            (Document.version == latest_docs_subquery.c.max_version)
        )
        .all()
    )

    # Debug print of filtered documents
    for rec in records:
        print(f"[consolidated-rows] doc -> id:{rec.id} filename:{rec.filename} user:{rec.user_id} version:{rec.version}")

    if not records:
        return JSONResponse(status_code=404, content={"detail": f"No records found for workflow_path '{cleaned_dir}'"})

    # Check if we already have a consolidated Json record
    existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()

    combined_data: list = []
    desired_fields = [
        "report_date", "loan_segment", "cis_number", "pn_number",
        "loan_amount", "outstanding_balance", "amortization", "booking_date", "dpd"
    ]

    try:
        # Build combined_data from each latest Document.json_data
        for record in records:
            if not record.json_data:
                print(f"[consolidated-rows] skipping doc id={record.id} filename={record.filename} - no json_data")
                continue

            try:
                parsed = json.loads(record.json_data)
            except Exception as e:
                print(f"[consolidated-rows] failed to parse json_data for doc id={record.id} filename={record.filename}: {e}")
                continue

            # Normalize structure: parsed might be list or dict-of-lists or dict with original_data
            rows = []
            if isinstance(parsed, list):
                rows = parsed
            elif isinstance(parsed, dict):
                for v in parsed.values():
                    if isinstance(v, list):
                        rows.extend(v)
                    elif isinstance(v, dict) and isinstance(v.get("original_data"), list):
                        rows.extend(v.get("original_data"))
            else:
                # unknown structure, skip
                continue

            # Filter only desired fields per row
            for row in rows:
                # row might not be a dict, guard
                if not isinstance(row, dict):
                    continue
                filtered_row = {k: row.get(k) for k in desired_fields}
                combined_data.append(filtered_row)

        if not combined_data:
            return JSONResponse(status_code=404, content={"detail": "No valid data found in any records."})

        # If there is an existing consolidated Json entry, update it (this implements "laging mag aupdate to")
        if existing:
            print(f"[consolidated-rows] updating existing consolidated Json id={existing.id}")
            existing.json_data = json.dumps(combined_data)
            existing.user_id = current_user.id  # optional: refresh owner
            db.add(existing)
            db.commit()
            # Return the updated consolidated data (deserialized)
            existing_data = json.loads(existing.json_data)
            return JSONResponse(status_code=200, content=existing_data)
        else:
            # Create new consolidated Json record
            print("[consolidated-rows] creating new consolidated Json record")
            new_record = JsonData(
                user_id=current_user.id,
                name=name,
                workflow_path=workflow_path,
                json_data=json.dumps(combined_data)
            )
            db.add(new_record)
            db.commit()
            return JSONResponse(content=combined_data)

    except Exception as e:
        print(f"[consolidated-rows] unexpected error: {e}")
        return JSONResponse(status_code=500, content={"detail": f"Error processing records: {str(e)}"})


@router.post("/pivot-dpd")
def pivot_dpd_table(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        workflow_path = payload.get("workflow_path")
        name = "pivoting"
        payload_rows = payload.get("row", [])

        if not workflow_path:
            return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

        print(f"[pivot-dpd] workflow_path={workflow_path}; payload_rows_present={isinstance(payload_rows, list) and len(payload_rows) > 0}")

        # Check cached Json (we will update it after recompute)
        existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
        if existing:
            print(f"[pivot-dpd] cached Json found id={existing.id} (will be updated after recompute)")

        rows_to_use: List[Dict[str, Any]] = []
        if isinstance(payload_rows, list) and len(payload_rows) > 0:
            print("[pivot-dpd] using payload rows")
            rows_to_use = payload_rows
        else:
            print("[pivot-dpd] payload rows empty — building from latest Document.json_data")
            latest_docs_subquery = (
                db.query(
                    Document.workflow_path,
                    Document.user_id,
                    Document.filename,
                    func.max(Document.version).label("max_version")
                )
                .filter(Document.workflow_path == workflow_path)
                .group_by(Document.workflow_path, Document.user_id, Document.filename)
                .subquery()
            )

            records = (
                db.query(Document)
                .join(
                    latest_docs_subquery,
                    (Document.workflow_path == latest_docs_subquery.c.workflow_path) &
                    (Document.user_id == latest_docs_subquery.c.user_id) &
                    (Document.filename == latest_docs_subquery.c.filename) &
                    (Document.version == latest_docs_subquery.c.max_version)
                )
                .all()
            )

            for rec in records:
                print(f"[pivot-dpd] doc -> id:{rec.id} filename:{rec.filename} user:{rec.user_id} version:{rec.version}")

            if not records:
                return JSONResponse(status_code=404, content={"detail": f"No Document records found for workflow_path '{workflow_path}'"})

            for record in records:
                if not record.json_data:
                    print(f"[pivot-dpd] skipping doc id={record.id} filename={record.filename} - no json_data")
                    continue
                try:
                    parsed = json.loads(record.json_data)
                except Exception as e:
                    print(f"[pivot-dpd] failed to parse json_data for doc id={record.id} filename={record.filename}: {e}")
                    continue

                if isinstance(parsed, list):
                    rows = parsed
                elif isinstance(parsed, dict):
                    rows = []
                    for v in parsed.values():
                        if isinstance(v, list):
                            rows.extend(v)
                        elif isinstance(v, dict) and isinstance(v.get("original_data"), list):
                            rows.extend(v.get("original_data"))
                else:
                    rows = []

                for r in rows:
                    if isinstance(r, dict):
                        rows_to_use.append(r)

            print(f"[pivot-dpd] combined rows length from DB: {len(rows_to_use)}")

        if not isinstance(rows_to_use, list) or len(rows_to_use) == 0:
            return JSONResponse(status_code=400, content={"detail": "No row data available to process (payload or DB)."})

        # Original pivot logic (unchanged)
        df = pd.DataFrame(rows_to_use)
        if df.empty:
            return JSONResponse(status_code=400, content={"detail": "Payload row is empty"})

        df.replace("", pd.NA, inplace=True)
        required_columns = {"pn_number", "loan_segment", "report_date", "dpd"}
        if not required_columns.issubset(df.columns):
            return JSONResponse(status_code=400, content={"detail": f"Missing required columns: {required_columns - set(df.columns)}"})

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

        # Save/update Json as requested (update if exists)
        if existing:
            print(f"[pivot-dpd] updating existing Json id={existing.id}")
            existing.json_data = json.dumps(result)
            existing.user_id = current_user.id
            db.add(existing)
            db.commit()
            existing_data = json.loads(existing.json_data)
            return JSONResponse(status_code=200, content=existing_data)
        else:
            print("[pivot-dpd] creating new pivoting Json record")
            new_record = JsonData(
                user_id=current_user.id,
                name=name,
                workflow_path=workflow_path,
                json_data=json.dumps(result)
            )
            db.add(new_record)
            db.commit()
            return JSONResponse(status_code=200, content=result)

    except Exception as e:
        print(f"[pivot-dpd] unexpected error: {e}")
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
        # Step 1: Extract workflow_path and row
        workflow_path = payload.get("workflow_path")
        name = "bucket-dpd"
        payload_rows = payload.get("row", [])

        if not workflow_path:
            return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

        # Debug
        print(f"[bucket-dpd] workflow_path={workflow_path}; payload_rows_present={isinstance(payload_rows, list) and len(payload_rows) > 0}")

        # Step 2: See if a cached Json exists (we won't return it immediately)
        existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
        if existing:
            print(f"[bucket-dpd] cached Json found id={existing.id} (will be updated after recompute)")

        # Step 3: Determine rows_to_use — prefer payload rows, else gather from latest Documents
        rows_to_use: List[Dict[str, Any]] = []

        if isinstance(payload_rows, list) and len(payload_rows) > 0:
            print("[bucket-dpd] using payload rows")
            rows_to_use = payload_rows
        else:
            print("[bucket-dpd] payload rows empty — building from latest Document.json_data")
            latest_docs_subquery = (
                db.query(
                    Document.workflow_path,
                    Document.user_id,
                    Document.filename,
                    func.max(Document.version).label("max_version")
                )
                .filter(Document.workflow_path == workflow_path)
                .group_by(Document.workflow_path, Document.user_id, Document.filename)
                .subquery()
            )

            records = (
                db.query(Document)
                .join(
                    latest_docs_subquery,
                    (Document.workflow_path == latest_docs_subquery.c.workflow_path) &
                    (Document.user_id == latest_docs_subquery.c.user_id) &
                    (Document.filename == latest_docs_subquery.c.filename) &
                    (Document.version == latest_docs_subquery.c.max_version)
                )
                .all()
            )

            for rec in records:
                print(f"[bucket-dpd] doc -> id:{rec.id} filename:{rec.filename} user:{rec.user_id} version:{rec.version}")

            if not records:
                return JSONResponse(status_code=404, content={"detail": f"No Document records found for workflow_path '{workflow_path}'"})

            for record in records:
                if not record.json_data:
                    print(f"[bucket-dpd] skipping doc id={record.id} filename={record.filename} - no json_data")
                    continue
                try:
                    parsed = json.loads(record.json_data)
                except Exception as e:
                    print(f"[bucket-dpd] failed to parse json_data for doc id={record.id} filename={record.filename}: {e}")
                    continue

                # Normalize structure: parsed might be list or dict-of-lists or dict with original_data
                if isinstance(parsed, list):
                    rows = parsed
                elif isinstance(parsed, dict):
                    rows = []
                    for v in parsed.values():
                        if isinstance(v, list):
                            rows.extend(v)
                        elif isinstance(v, dict) and isinstance(v.get("original_data"), list):
                            rows.extend(v.get("original_data"))
                        # else ignore
                else:
                    rows = []

                for r in rows:
                    if isinstance(r, dict):
                        rows_to_use.append(r)

            print(f"[bucket-dpd] combined rows length from DB: {len(rows_to_use)}")

        # After this, rows_to_use must be a list of dicts
        if not isinstance(rows_to_use, list) or len(rows_to_use) == 0:
            return JSONResponse(status_code=400, content={"detail": "No row data available to process (payload or DB)."})

        # Step 4: Original processing — do not change calculations/responses
        df = pd.DataFrame(rows_to_use)

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

        # Apply DPD bucket transformation (keep your dpd_bucket function)
        for col in date_columns:
            pivot_df[col] = pd.to_numeric(pivot_df[col], errors="coerce")
            pivot_df[col] = pivot_df[col].apply(dpd_bucket)

        # Print summary (keeps your original commented prints but adds debug)
        for col in date_columns:
            bucket_counts = pivot_df[col].value_counts(dropna=False).to_dict()
            total_accounts = 0
            for bucket in ["0", "1", "2", "3", "4", "NA"]:
                count = bucket_counts.get(bucket, 0)
                if bucket in ["0", "1", "2", "3", "4"]:
                    total_accounts += count
            print(f"[bucket-dpd] {col} total accounts (0–4): {total_accounts}")

        # Step 5: Save to DB and return (keep same return structure)
        result = pivot_df.to_dict(orient="records")

        if existing:
            # update existing cached record
            print(f"[bucket-dpd] updating existing Json id={existing.id}")
            existing.json_data = json.dumps(result)
            existing.user_id = current_user.id  # optionally refresh owner
            db.add(existing)
            db.commit()
            existing_data = json.loads(existing.json_data)
            return JSONResponse(status_code=200, content=existing_data)
        else:
            print("[bucket-dpd] creating new Json record")
            new_record = JsonData(
                user_id=current_user.id,
                name="bucket-dpd",
                workflow_path=workflow_path,
                json_data=json.dumps(result)
            )
            db.add(new_record)
            db.commit()
            return JSONResponse(status_code=200, content=result)

    except Exception as e:
        print(f"[bucket-dpd] unexpected error: {e}")
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
        print(f"Error in dpd_bucket1 for value: {dpd_value} -> {e}")
        return "Invalid"


@router.post("/bucket-dpd-everbad")
def bucket_dpd_everbad(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        workflow_path = payload.get("workflow_path")
        name = "bucket-dpd-everbad"
        payload_rows = payload.get("row", [])

        if not workflow_path:
            return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

        print(f"[bucket-dpd-everbad] workflow_path={workflow_path}; payload_rows_present={isinstance(payload_rows, list) and len(payload_rows) > 0}")

        existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
        if existing:
            print(f"[bucket-dpd-everbad] cached Json found id={existing.id} (will be updated after recompute)")

        rows_to_use: List[Dict[str, Any]] = []
        if isinstance(payload_rows, list) and len(payload_rows) > 0:
            print("[bucket-dpd-everbad] using payload rows")
            rows_to_use = payload_rows
        else:
            print("[bucket-dpd-everbad] payload rows empty — building from latest Document.json_data")
            latest_docs_subquery = (
                db.query(
                    Document.workflow_path,
                    Document.user_id,
                    Document.filename,
                    func.max(Document.version).label("max_version")
                )
                .filter(Document.workflow_path == workflow_path)
                .group_by(Document.workflow_path, Document.user_id, Document.filename)
                .subquery()
            )

            records = (
                db.query(Document)
                .join(
                    latest_docs_subquery,
                    (Document.workflow_path == latest_docs_subquery.c.workflow_path) &
                    (Document.user_id == latest_docs_subquery.c.user_id) &
                    (Document.filename == latest_docs_subquery.c.filename) &
                    (Document.version == latest_docs_subquery.c.max_version)
                )
                .all()
            )

            for rec in records:
                print(f"[bucket-dpd-everbad] doc -> id:{rec.id} filename:{rec.filename} user:{rec.user_id} version:{rec.version}")

            if not records:
                return JSONResponse(status_code=404, content={"detail": f"No Document records found for workflow_path '{workflow_path}'"})

            for record in records:
                if not record.json_data:
                    print(f"[bucket-dpd-everbad] skipping doc id={record.id} filename={record.filename} - no json_data")
                    continue
                try:
                    parsed = json.loads(record.json_data)
                except Exception as e:
                    print(f"[bucket-dpd-everbad] failed to parse json_data for doc id={record.id} filename={record.filename}: {e}")
                    continue

                if isinstance(parsed, list):
                    rows = parsed
                elif isinstance(parsed, dict):
                    rows = []
                    for v in parsed.values():
                        if isinstance(v, list):
                            rows.extend(v)
                        elif isinstance(v, dict) and isinstance(v.get("original_data"), list):
                            rows.extend(v.get("original_data"))
                else:
                    rows = []

                for r in rows:
                    if isinstance(r, dict):
                        rows_to_use.append(r)

            print(f"[bucket-dpd-everbad] combined rows length from DB: {len(rows_to_use)}")

        if not isinstance(rows_to_use, list) or len(rows_to_use) == 0:
            return JSONResponse(status_code=400, content={"detail": "No row data available to process (payload or DB)."})

        # Original everbad processing (unchanged)
        df = pd.DataFrame(rows_to_use)
        if df.empty:
            return JSONResponse(status_code=400, content={"detail": "Payload is empty"})

        required_columns = {"pn_number", "loan_segment", "report_date", "dpd"}
        if not required_columns.issubset(df.columns):
            return JSONResponse(status_code=400, content={"detail": f"Missing required columns: {required_columns - set(df.columns)}"})

        df.replace(["", None], pd.NA, inplace=True)
        df["report_date"] = pd.to_datetime(df["report_date"], format="%d/%m/%Y", errors="coerce")
        df.dropna(subset=["report_date"], inplace=True)
        df["dpd"] = pd.to_numeric(df["dpd"], errors="coerce")

        pivot_df = df.pivot_table(
            index=["pn_number", "loan_segment"],
            columns=df["report_date"].dt.strftime('%Y-%m-%d'),
            values="dpd",
            aggfunc="first"
        ).reset_index()

        date_columns = sorted([col for col in pivot_df.columns if col not in {"pn_number", "loan_segment"}])
        for col in date_columns:
            pivot_df[col] = pd.to_numeric(pivot_df[col], errors="coerce")

        for idx, row in pivot_df.iterrows():
            everbad = False
            for col in date_columns:
                val = row[col]
                if pd.isna(val):
                    continue
                try:
                    if val > 90:
                        everbad = True
                        pivot_df.at[idx, col] = 91
                    elif everbad:
                        pivot_df.at[idx, col] = 91
                except:
                    continue

        for col in date_columns:
            pivot_df[col] = pivot_df[col].apply(dpd_bucket1)

        result = pivot_df.to_dict(orient="records")

        if existing:
            print(f"[bucket-dpd-everbad] updating existing Json id={existing.id}")
            existing.json_data = json.dumps(result)
            existing.user_id = current_user.id
            db.add(existing)
            db.commit()
            existing_data = json.loads(existing.json_data)
            return JSONResponse(status_code=200, content=existing_data)
        else:
            print("[bucket-dpd-everbad] creating new Json record")
            new_record = JsonData(
                user_id=current_user.id,
                name=name,
                workflow_path=workflow_path,
                json_data=json.dumps(result)
            )
            db.add(new_record)
            db.commit()
            return JSONResponse(status_code=200, content=result)

    except Exception as e:
        print(f"[bucket-dpd-everbad] unexpected error: {e}")
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
    workflow_path = payload.get("workflow_path")
    payload_rows = payload.get("row", [])
    name = "calculate_odr"

    if not workflow_path:
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

    print(f"[calculate_odr] workflow_path={workflow_path}; payload_rows_present={isinstance(payload_rows, list) and len(payload_rows) > 0}")

    existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
    if existing:
        print(f"[calculate_odr] cached Json found id={existing.id} (will be updated after recompute)")

    rows_to_use: List[Dict[str, Any]] = []
    if isinstance(payload_rows, list) and len(payload_rows) > 0:
        rows_to_use = payload_rows
        print("[calculate_odr] using payload rows")
    else:
        print("[calculate_odr] payload rows empty — building from latest Document.json_data")
        latest_docs_subquery = (
            db.query(
                Document.workflow_path,
                Document.user_id,
                Document.filename,
                func.max(Document.version).label("max_version")
            )
            .filter(Document.workflow_path == workflow_path)
            .group_by(Document.workflow_path, Document.user_id, Document.filename)
            .subquery()
        )

        records = (
            db.query(Document)
            .join(
                latest_docs_subquery,
                (Document.workflow_path == latest_docs_subquery.c.workflow_path) &
                (Document.user_id == latest_docs_subquery.c.user_id) &
                (Document.filename == latest_docs_subquery.c.filename) &
                (Document.version == latest_docs_subquery.c.max_version)
            )
            .all()
        )

        for rec in records:
            print(f"[calculate_odr] doc -> id:{rec.id} filename:{rec.filename} user:{rec.user_id} version:{rec.version}")

        for record in records:
            if not record.json_data:
                print(f"[calculate_odr] skipping doc id={record.id} filename={record.filename} - no json_data")
                continue
            try:
                parsed = json.loads(record.json_data)
            except Exception as e:
                print(f"[calculate_odr] failed to parse json_data for doc id={record.id} filename={record.filename}: {e}")
                continue
            if isinstance(parsed, list):
                rows = parsed
            elif isinstance(parsed, dict):
                rows = []
                for v in parsed.values():
                    if isinstance(v, list):
                        rows.extend(v)
                    elif isinstance(v, dict) and isinstance(v.get("original_data"), list):
                        rows.extend(v.get("original_data"))
            else:
                rows = []
            for r in rows:
                if isinstance(r, dict):
                    rows_to_use.append(r)
        print(f"[calculate_odr] combined rows length from DB: {len(rows_to_use)}")

    if not isinstance(rows_to_use, list) or len(rows_to_use) == 0:
        return JSONResponse(status_code=400, content={"detail": "No row data available to process (payload or DB)."})

    # Keep original ODR logic exactly
    def is_valid_date(s):
        try:
            pd.to_datetime(s)
            return True
        except:
            return False

    def clean_sequence(seq):
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

    row_data = rows_to_use
    if not row_data:
        return {"error": "Empty payload."}

    all_keys = row_data[0].keys()
    date_keys = sorted([k for k in all_keys if is_valid_date(k)], key=lambda x: pd.to_datetime(x))
    if len(date_keys) < 13:
        return {"error": "Need at least 13 months of data for 12-month ODR window."}

    results = []
    window_size = 12

    for i in range(len(date_keys) - window_size):
        obs = date_keys[i]
        start = (pd.to_datetime(obs) + pd.DateOffset(months=1)).strftime("%Y-%m-%d")
        end = date_keys[i + window_size]
        window_range = date_keys[i:i + window_size + 1]

        good_accounts = set()
        filtered_good_payload = []

        for row in row_data:
            pn = row.get("pn_number")
            seq = [str(row.get(k)) if row.get(k) not in [None, ''] else 'NA' for k in window_range]
            cleaned_seq = clean_sequence(seq)
            obs_val = cleaned_seq[0]
            if obs_val == 'NA':
                continue
            try:
                obs_int = int(obs_val)
                if 0 <= obs_int <= 3:
                    good_accounts.add(pn)
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

        results.append({
            "Observation point": obs,
            "Start of performance window": start,
            "End of performance window": end,
            "Number of Good": good_count,
            "Number of Good that turned Bad": bad_count,
            "ODR": f"{odr:.2f}%"
        })

    # Save or update cache
    if existing:
        print(f"[calculate_odr] updating existing Json id={existing.id}")
        existing.json_data = json.dumps(results)
        existing.user_id = current_user.id
        db.add(existing)
        db.commit()
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))
    else:
        new_record = JsonData(
            user_id=current_user.id,
            name=name,
            workflow_path=workflow_path,
            json_data=json.dumps(results)
        )
        db.add(new_record)
        db.commit()
        print("[calculate_odr] created new Json record")
        return JSONResponse(status_code=200, content=results)


@router.post("/migration-matrix")
def migration_matrix(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "migration-matrix"

    if not workflow_path:
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

    print(f"[migration-matrix] workflow_path={workflow_path}; payload_rows_present={isinstance(row_data, list) and len(row_data) > 0}")
    existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
    if existing:
        print(f"[migration-matrix] cached Json found id={existing.id} (will be updated after recompute if payload provided)")

    # If payload provided use it, else if cached exists return it immediately
    if (not isinstance(row_data, list) or len(row_data) == 0) and existing:
        print("[migration-matrix] payload empty, returning existing cached result")
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))

    rows_to_use = row_data
    if not isinstance(rows_to_use, list) or len(rows_to_use) == 0:
        return JSONResponse(status_code=400, content={"detail": "Missing payload row data for migration matrix."})

    # Original migration-matrix processing (unchanged)
    df = pd.DataFrame(rows_to_use)
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

    # Save or update cache
    if existing:
        print(f"[migration-matrix] updating existing Json id={existing.id}")
        existing.json_data = json.dumps(output)
        existing.user_id = current_user.id
        db.add(existing)
        db.commit()
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))
    else:
        new_record = JsonData(
            user_id=current_user.id,
            name=name,
            workflow_path=workflow_path,
            json_data=json.dumps(output)
        )
        db.add(new_record)
        db.commit()
        return JSONResponse(status_code=200, content=output)


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
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "migration_matrix_percentage"

    if not workflow_path:
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

    print(f"[migration-matrix-percentage] workflow_path={workflow_path}; payload_rows_present={isinstance(row_data, list) and len(row_data) > 0}")
    existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
    if existing:
        print(f"[migration-matrix-percentage] cached Json found id={existing.id} (will be updated after recompute if payload provided)")

    # If no payload but cached exists return it
    if (not isinstance(row_data, list) or len(row_data) == 0) and existing:
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))

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

    if existing:
        print(f"[migration-matrix-percentage] updating existing Json id={existing.id}")
        existing.json_data = json.dumps(grouped_results)
        existing.user_id = current_user.id
        db.add(existing)
        db.commit()
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))
    else:
        new_record = JsonData(
            user_id=current_user.id,
            name=name,
            workflow_path=workflow_path,
            json_data=json.dumps(grouped_results)
        )
        db.add(new_record)
        db.commit()
        return JSONResponse(status_code=200, content=grouped_results)


@router.post("/migration-matrix-average-final")
def calculate_bucket_matrix_average(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workflow_path = payload.get("workflow_path")
    row_data = payload.get("row", [])
    name = "migration_matrix_average"

    if not workflow_path:
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

    print(f"[migration-matrix-average] workflow_path={workflow_path}; payload_rows_present={isinstance(row_data, list) and len(row_data) > 0}")
    existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
    if existing:
        print(f"[migration-matrix-average] cached Json found id={existing.id} (will be updated after recompute if payload provided)")

    if (not isinstance(row_data, list) or len(row_data) == 0) and existing:
        print("[migration-matrix-average] payload empty, returning existing cached result")
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))

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

    # Helper: truncate instead of round
    def truncate(num: float, decimals: int = 2) -> float:
        if pd.isna(num):
            return 0.0
        factor = 10 ** decimals
        return int(num * factor) / factor

    # compute averages (unchanged logic)
    average_results = {}
    for bucket in merged_df["Bucket"].unique():
        bucket_values = {}
        for col in dpd_cols:
            bucket_values[col] = {"sum": 0, "count": 0}
        for month in merged_df["Report_Month"].unique():
            month_df = merged_df[(merged_df["Report_Month"] == month) & (merged_df["Bucket"] == bucket)]
            if not month_df.empty:
                for col in dpd_cols:
                    value = month_df[col].sum()
                    count = month_df[col].count()
                    bucket_values[col]["sum"] += value
                    bucket_values[col]["count"] += count
        for col in dpd_cols:
            avg = bucket_values[col]["sum"] / bucket_values[col]["count"] if bucket_values[col]["count"] > 0 else 0
            average_results.setdefault(bucket, {})[col] = avg
            print(f"[migration-matrix-average] Bucket {bucket}, {col}: average = {avg}")

    final_result = []
    for from_bucket in sorted(average_results.keys()):
        row = {"Bucket": int(from_bucket)}
        total = 0
        for col in dpd_cols:
            val = average_results[from_bucket].get(col, 0)
            row[col] = val
            total += val
        row["Total"] = total
        final_result.append(row)

    if existing:
        print(f"[migration-matrix-average] updating existing Json id={existing.id}")
        existing.json_data = json.dumps(final_result)
        existing.user_id = current_user.id
        db.add(existing)
        db.commit()
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))
    else:
        new_record = JsonData(
            user_id=current_user.id,
            name=name,
            workflow_path=workflow_path,
            json_data=json.dumps(final_result)
        )
        db.add(new_record)
        db.commit()
        return JSONResponse(status_code=200, content=final_result)

@router.get("/get-migration-matrix-average")
def get_migration_matrix_average(workflow_path: str = Query(..., description="Subdirectory under server/files containing Excel files"),
    db: Session = Depends(get_db)):
    # Step 1: Check if workflow_path already exists in D
    name = "migration_matrix_average"
    print(workflow_path)
    # Step 2: Check if workflow_path already exists in DB
    existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
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

    if not workflow_path:
        return JSONResponse(status_code=400, content={"detail": "Missing 'workflow_path'."})

    print(f"[migration-matrix-12months] workflow_path={workflow_path}; payload_rows_present={isinstance(row_data, list) and len(row_data) > 0}")
    existing = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
    if existing:
        print(f"[migration-matrix-12months] cached Json found id={existing.id} (will be updated after recompute if payload provided)")

    if (not isinstance(row_data, list) or len(row_data) == 0) and existing:
        print("[migration-matrix-12months] payload empty, returning existing cached result")
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))

    if not row_data:
        return []

    dpd_cols = ["0 DPD_0", "1-30 DPD_1", "31-60 DPD_2", "61-90 DPD_3", "91+ DPD_4"]
    df = pd.DataFrame(row_data).sort_values("Bucket").reset_index(drop=True)

    if not all(col in df.columns for col in dpd_cols):
        return JSONResponse(status_code=400, content={"detail": "Missing one or more DPD columns in data"})

    matrix = df[dpd_cols].to_numpy(dtype=float)
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

    if existing:
        print(f"[migration-matrix-12months] updating existing Json id={existing.id}")
        existing.json_data = json.dumps(result_list)
        existing.user_id = current_user.id
        db.add(existing)
        db.commit()
        return JSONResponse(status_code=200, content=json.loads(existing.json_data))
    else:
        new_record = JsonData(
            user_id=current_user.id,
            name=name,
            workflow_path=workflow_path,
            json_data=json.dumps(result_list)
        )
        db.add(new_record)
        db.commit()
        return JSONResponse(status_code=200, content=result_list)

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

@router.get("/document-versions")
def get_document_versions(
    filename: str = Query(..., description="Name of the document file"),
    workflow: str = Query(..., description="Workflow path"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict]:
    """
    Fetch all versions of a document for a given workflow and filename.
    """
    try:
        documents = (
            db.query(Document)
            .filter(
                Document.filename == filename,
                Document.workflow_path == workflow,
                Document.user_id == current_user.id,
            )
            .order_by(Document.version.desc())
            .all()
        )
        if not documents:
            raise HTTPException(status_code=500, detail="No versions found for this documentdd")

        result = [
            {
                "id": doc.id,
                "filename": doc.filename,
                "workflow_path": doc.workflow_path,
                "version": doc.version,
                "created_at": doc.created_at,
            }
            for doc in documents
        ]

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching document versions: {str(e)}")

@router.get("/{document_id}")
def get_document_by_id(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(Document).filter(Document.id == document_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="Document not found")

    # Base response
    response = {
        "id": record.id,
        "filename": record.filename,
        "workflow_path": record.workflow_path,
        "version": record.version,
        "json_data": None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "status_metrics": {
            "valid": 0,
            "error": 0,
            "missing": 0,
            "duplicate": 0
        }
    }

    # --- Process Excel / JSON like read-excel ---
    df_rows = None
    required_columns = [
        "report_date", "loan_segment", "cis_number", "pn_number",
        "loan_amount", "outstanding_balance", "amortization", "booking_date",
        "maturity_date", "eir", "monthly_payments", "dpd"
    ]

    base_dir = Path(__file__).parents[2] / "files" / record.workflow_path.strip('"/')

    # Helper functions (match read-excel behavior)
    def extract_rows(parsed):
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    return v
                if isinstance(v, dict) and isinstance(v.get("original_data"), list):
                    return v.get("original_data")
        return []

    def to_decimal_with_raw(x):
        raw = x
        try:
            if x is None or pd.isna(x):
                return None, raw
            if isinstance(x, Decimal):
                return x, raw
            if isinstance(x, int):
                return Decimal(x), raw
            s = str(x).replace(",", "").strip()
            if s == "":
                return None, raw
            return Decimal(s), raw
        except Exception:
            return None, raw

    def is_missing_value(val):
        if val is None:
            return True
        try:
            if pd.isna(val):
                return True
        except Exception:
            pass
        if isinstance(val, str):
            s = val.strip().lower()
            if s in ("", "na", "n/a", "null", "none"):
                return True
        return False

    # Prefer JSON stored in DB (same approach as read-excel)
    if record.json_data:
        try:
            parsed = json.loads(record.json_data)
            df_rows = extract_rows(parsed)
        except Exception:
            df_rows = None

    # Fallback to reading Excel file (same as read-excel)
    if not df_rows:
        file_path = base_dir / record.filename
        if file_path.exists():
            try:
                df = pd.read_excel(file_path, engine="openpyxl", dtype=object)
                df.columns = [str(c).strip().lower() for c in df.columns]
                df.replace([np.inf, -np.inf], np.nan, inplace=True)
                df_rows = [dict(r) for r in df.to_dict(orient="records")]

                # Save extracted JSON into DB for future (same behavior)
                try:
                    record.json_data = json.dumps(df_rows)
                    db.add(record)
                    db.commit()
                except Exception:
                    db.rollback()
            except Exception:
                df_rows = []

    if df_rows:
        # --- Row processing (mirror read-excel) ---
        intermediate_rows: List[Dict[str, Any]] = []
        dup_keys: List[tuple] = []

        # local helpers used in read-excel (expect these to be present in module)
        # try_parse_date and sanitize_for_json are assumed available

        for row in df_rows:
            # Use a shallow copy so original fields remain available
            raw_row = dict(row)
            row_out: Dict[str, Any] = raw_row.copy()
            row_out["source_file"] = record.filename
            row_out["error_explanations"] = []
            row_out["errors"] = []
            row_out["missing_fields"] = []

            # --- Missing check: which required fields are empty? ---
            for col in required_columns:
                val = raw_row.get(col)
                if is_missing_value(val) or (isinstance(val, str) and val.strip() == ""):
                    row_out["missing_fields"].append(col)

            if row_out["missing_fields"]:
                row_out["status"] = "missing"
                row_out["error_explanations"].append(
                    f"Missing required fields: {', '.join(row_out['missing_fields'])}"
                )
                intermediate_rows.append(row_out)
                # still add dup key using raw report_date to track duplicates even for missing rows
                rep_norm = row_out.get("report_date") or ""
                cis = str(row_out.get("cis_number") or "").strip()
                pn = str(row_out.get("pn_number") or "").strip()
                dup_keys.append((rep_norm, cis, pn))
                continue

            # start as valid
            row_out["status"] = "valid"

            # --- Date parsing checks with detailed messages ---
            for date_col in ("report_date", "booking_date", "maturity_date"):
                raw_val = raw_row.get(date_col)
                parsed, norm = try_parse_date(raw_val)
                if parsed is None:
                    code = f"invalid_date_format:{date_col}"
                    row_out["errors"].append(code)
                    row_out["error_explanations"].append(
                        f"Unparsable date in '{date_col}': original value = {repr(raw_val)}. Expected formats: YYYY-MM-DD, YYYY-MM, DD/MM/YYYY, MM/DD/YYYY, etc."
                    )
                    row_out["status"] = "error"
                else:
                    row_out[f"{date_col}_parsed"] = parsed.strftime("%Y-%m-%d")

            # --- Numeric parsing with Decimal (no float conversion) ---
            dpd_val, dpd_raw = to_decimal_with_raw(raw_row.get("dpd"))
            amort_val, amort_raw = to_decimal_with_raw(raw_row.get("amortization"))
            monthly_pay_val, monthly_pay_raw = to_decimal_with_raw(raw_row.get("monthly_payments"))

            if dpd_val is None:
                row_out["errors"].append("numeric_parse:dpd")
                row_out["error_explanations"].append(f"Could not parse numeric field 'dpd' (raw value: {repr(dpd_raw)})")
                row_out["status"] = "error"
            if amort_val is None:
                row_out["errors"].append("numeric_parse:amortization")
                row_out["error_explanations"].append(f"Could not parse numeric field 'amortization' (raw value: {repr(amort_raw)})")
                row_out["status"] = "error"
            if monthly_pay_val is None:
                row_out["errors"].append("numeric_parse:monthly_payments")
                row_out["error_explanations"].append(f"Could not parse numeric field 'monthly_payments' (raw value: {repr(monthly_pay_raw)})")
                row_out["status"] = "error"

            # --- Payment consistency check (flag only — DO NOT CORRECT) using Decimal ==
            try:
                if dpd_val is not None and dpd_val == Decimal(0):
                    if amort_val is not None and monthly_pay_val is not None and monthly_pay_val != amort_val:
                        row_out["errors"].append("payment_mismatch_dpd_0")
                        row_out["error_explanations"].append(
                            f"DPD is 0 but monthly_payments ({monthly_pay_raw}) != amortization ({amort_raw}). Expected payment equal to amortization when DPD=0."
                        )
                        row_out["status"] = "error"
            except Exception:
                row_out["errors"].append("payment_consistency_check_failed")
                row_out["error_explanations"].append("Payment consistency check failed due to unexpected error.")
                row_out["status"] = "error"

            # Save canonical key for duplicate detection (use parsed report_date if available)
            rep_norm = row_out.get("report_date_parsed") or str(row_out.get("report_date") or "")
            cis = str(row_out.get("cis_number") or "").strip()
            pn = str(row_out.get("pn_number") or "").strip()
            dup_keys.append((rep_norm, cis, pn))

            intermediate_rows.append(row_out)

        # Duplicate detection within file (and across rows parsed)
        from collections import Counter, defaultdict
        dup_counter = Counter(dup_keys)
        duplicates_found = {k: v for k, v in dup_counter.items() if v > 1}

        # annotate duplicates and add explanations (preserve grouping sequence)
        if duplicates_found:
            group_positions: defaultdict = defaultdict(int)
            for row in intermediate_rows:
                rep_norm = row.get("report_date_parsed") or str(row.get("report_date") or "")
                cis = str(row.get("cis_number") or "").strip()
                pn = str(row.get("pn_number") or "").strip()
                key = (rep_norm, cis, pn)
                if key in duplicates_found:
                    row["duplicate"] = True
                    row["duplicate_count"] = int(duplicates_found[key])
                    row.setdefault("errors", []).append("duplicate_cis_pn_for_report_date")
                    row.setdefault("error_explanations", []).append(
                        f"Duplicate records found for (report_date={rep_norm}, cis_number={cis}, pn_number={pn}). Occurrences: {duplicates_found[key]}."
                    )
                    group_positions[key] += 1
                    row["group_sequence"] = group_positions[key]

        # compute file-level ordering sequence (row_sequence) and precise group_sequence
        ordering = []
        for i, row in enumerate(intermediate_rows):
            rep_norm = row.get("report_date_parsed") or str(row.get("report_date") or "")
            cis = str(row.get("cis_number") or "").strip()
            pn = str(row.get("pn_number") or "").strip()
            ordering.append((i, rep_norm or "", cis or "", pn or ""))

        ordering_sorted = sorted(ordering, key=lambda t: (t[1], t[2], t[3]))

        for seq, (orig_index, *_rest) in enumerate(ordering_sorted, start=1):
            intermediate_rows[orig_index]["row_sequence"] = int(seq)

        if duplicates_found:
            group_counters: defaultdict = defaultdict(int)
            for orig_index, rep_norm, cis, pn in [(t[0], t[1], t[2], t[3]) for t in ordering_sorted]:
                key = (rep_norm, cis, pn)
                if key in duplicates_found:
                    group_counters[key] += 1
                    intermediate_rows[orig_index]["group_sequence"] = int(group_counters[key])
                else:
                    intermediate_rows[orig_index]["group_sequence"] = 1
        else:
            # ensure group_sequence exists
            for r in intermediate_rows:
                if "group_sequence" not in r:
                    r["group_sequence"] = 1

        # finalize and sanitize processed_rows for JSON output (use same sanitizer)
        processed_rows = [sanitize_for_json(r) for r in intermediate_rows]

        # build per-pn summary for payment_mismatch_dpd_0 (and include cis + report_date)
        seen = set()
        flagged_pn_summary = []
        for r in processed_rows:
            errors = r.get("errors") or []
            if "payment_mismatch_dpd_0" in errors:
                rep = r.get("report_date_parsed") or r.get("report_date")
                pn = r.get("pn_number")
                cis = r.get("cis_number")
                key = (rep, pn)
                if key not in seen:
                    seen.add(key)
                    flagged_pn_summary.append({
                        "report_date": rep,
                        "pn_number": pn,
                        "cis_number": cis,
                        "reason": "DPD is 0 but monthly_payments != amortization for this pn_number",
                        "occurrences": sum(1 for x in processed_rows if (x.get("report_date_parsed") or x.get("report_date")) == rep and x.get("pn_number") == pn and ("payment_mismatch_dpd_0" in (x.get("errors") or [])))
                    })

        total_rows = len(processed_rows)
        missing_count = sum(1 for r in processed_rows if r.get("status") == "missing")
        valid_count = sum(1 for r in processed_rows if r.get("status") == "valid")
        error_count = total_rows - (valid_count + missing_count)

        response["status_metrics"] = {
            "valid": int(valid_count),
            "error": int(error_count),
            "missing": int(missing_count),
            "duplicate": int(sum(1 for r in processed_rows if r.get("duplicate") is True)),
        }

        # include processed rows and summary to match read-excel shape
        response["json_data"] = processed_rows
        response["flagged_pn_summary"] = flagged_pn_summary

    return response

@router.get("/workflow-documents")
def get_documents_by_workflow_and_types(
    workflow_id: int = Query(..., description="Workflow ID"),
    document_types: str = Query(..., description="Comma-separated document types (e.g., 'monthly_historical_mev,quarterly_historical_mev')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get documents filtered by workflow ID and document types.
    """
    try:
        # Parse comma-separated document types
        doc_types_list = [doc_type.strip() for doc_type in document_types.split(',') if doc_type.strip()]
        
        if not doc_types_list:
            return JSONResponse(
                status_code=400, 
                content={"detail": "At least one document type must be provided"}
            )
        
        # Get workflow details from workflow_id
        from models.models import Workflow
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()
        
        if not workflow:
            return JSONResponse(
                status_code=404, 
                content={"detail": f"Workflow with ID {workflow_id} not found"}
            )
        
        # Build query to get only the first (most recent) document of each document_type
        from sqlalchemy import func
        
        # Use window function to get the latest document of each type
        from sqlalchemy import func, desc
        
        # Subquery with ROW_NUMBER to get only the first (latest) document per type
        latest_docs_subquery = (
            db.query(
                Document.id,
                Document.document_type,
                Document.created_at,
                func.row_number().over(
                    partition_by=Document.document_type,
                    order_by=[desc(Document.created_at), desc(Document.id)]
                ).label("rn")
            )
            .filter(
                Document.workflow_id == workflow_id,
                Document.user_id == current_user.id,
                Document.document_type.in_(doc_types_list)
            )
            .subquery()
        )
        
        # Main query to get only the first document of each type (rn = 1)
        query = db.query(Document).join(
            latest_docs_subquery,
            Document.id == latest_docs_subquery.c.id
        ).filter(
            latest_docs_subquery.c.rn == 1
        )
        
        documents = query.order_by(Document.created_at.desc()).all()
        
        if not documents:
            return JSONResponse(
                status_code=404, 
                content={"detail": f"No documents found for workflow_id={workflow_id} with document_types={document_types}"}
            )
        
        # Format response
        result = []
        for doc in documents:
            result.append({
                "id": doc.id,
                "filename": doc.filename,
                "workflow_path": doc.workflow_path,
                "workflow_id": workflow_id,
                "version": doc.version,
                "document_type": doc.document_type,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
                "has_json_data": bool(doc.json_data)
            })
        
        return JSONResponse(content={
            "code": 1,
            "msg": "Success",
            "success": True,
            "data": result,
        })
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Something went wrong: {str(e)}",
                "data": None
            }
        )



