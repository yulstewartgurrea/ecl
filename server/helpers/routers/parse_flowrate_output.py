import pandas as pd
import numpy as np
import os
import json

def parse_flowrate_output_file(path: str):
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