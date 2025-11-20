import json
import pandas as pd

def format_dataframe_constructor(json_data):
    raw = json_data

    # 1) If it's a JSON string → decode
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = raw  # already not JSON

    # 2) Handle double-encoded strings (string after first loads)
    if isinstance(data, str):
        data = json.loads(data)

    # 3) If dict wrapper → extract records
    if isinstance(data, dict):
        data = data.get('data') or data.get('records') or data.get('rows')

    # 4) Final guard
    if not isinstance(data, list):
        raise ValueError("Expected list of dicts for DataFrame input.")

    quarterly_df = pd.DataFrame(data)

    return quarterly_df