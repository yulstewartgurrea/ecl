def rename_bucket_cols(df):
    """
    Update column names from current format to standardized bucket transition format.
    
    Current format examples: '0 day', 'par 1  (1 & 30 days)', etc.
    Target format represents transitions: '0 day to PAR 1', 'PAR 1 to PAR 30', etc.
    """
    # Create a mapping of current column names to new transition names
    column_mapping = {
        '0 day to par 1': '0 day to PAR 1',
        'par 1 (1 & 30 days)': 'PAR 1 to PAR 30',
        'par 30 (31 & 60 days)': 'PAR 30 to PAR 60',
        'par 60 (61 & 90 days)': 'PAR 60 to PAR 90',
        'par 90 (91 & 120 days)': 'PAR 90 to PAR 120',
        'par 120 (121 & 180 days)': 'PAR 120 to PAR 180',
        'par 180 (181 & 240 days)': 'PAR 180 to PAR 240',
        'par 240 (241 & 360 days)': 'PAR 240 to PAR 360',
        'par 360 (361 & up days)': 'PAR 360 above',
        'date': 'date',  # Keep date column as is
        'total loan balance with c/p': 'total loan balance with c/p'  # Keep total balance as is
    }
    
    # Debug: Print actual column names
    print("Actual columns in DataFrame:", df.columns.tolist())
    
    # Create new column names list
    new_columns = []
    for col in df.columns:
        # Check if column name matches any of the mapping keys (case-insensitive)
        found = False
        col_normalized = col.strip().lower()
        
        for old_name, new_name in column_mapping.items():
            old_name_normalized = old_name.strip().lower()
            
            # Exact match
            if col_normalized == old_name_normalized:
                new_columns.append(new_name)
                found = True
                print(f"Matched: '{col}' -> '{new_name}'")
                break
        
        # If no mapping found, keep original column name
        if not found:
            new_columns.append(col)
            print(f"No match for: '{col}' - keeping original")
    
    # Apply the new column names
    df.columns = new_columns
    
    return df