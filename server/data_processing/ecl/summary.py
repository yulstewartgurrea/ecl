import pandas as pd
import traceback	

def process_summary_data(aging_report_file, ecl_file):
    try:
        aging_report_df = pd.read_excel(aging_report_file)
        buckets = aging_report_df.columns.str.lower().tolist()
        buckets = [col for col in buckets if col not in ['date', 'total loan balance with c/p']]

        ecl_df = pd.read_excel(ecl_file)
        ecl_df.columns = ecl_df.columns.str.strip().str.lower()
        
        df = pd.DataFrame({'aging category': buckets})

        # Count occurrences of each Aging Category in ecl_df
        aging_counts = ecl_df["aging category"].value_counts()
        # Map these counts back into df
        df["count"] = df["aging category"].map(aging_counts).fillna(0).astype(int)

        # Sum loan balance per Aging Category in ecl_df
        aging_sums = ecl_df.groupby("aging category")["loan_balance"].sum()
        # Map the summed values back into the df
        df["loan balance"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )
        
        # Sum loan balance per Aging Category in ecl_df
        aging_sums = ecl_df.groupby("aging category")["expected credit loss upside"].sum()
        # Map the summed values back into the df
        df["expected credit loss upside"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )
        
        # Sum loan balance per Aging Category in ecl_df
        aging_sums = ecl_df.groupby("aging category")["expected credit loss baseline"].sum()
        # Map the summed values back into the df
        df["expected credit loss baseline"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )
        
        # Sum loan balance per Aging Category in ecl_df
        aging_sums = ecl_df.groupby("aging category")["expected credit loss downside"].sum()
        # Map the summed values back into the df
        df["expected credit loss downside"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )

        # Sum loan balance per Aging Category in ecl_df
        aging_sums = ecl_df.groupby("aging category")["weighted ecl"].sum()
        # Map the summed values back into the df
        df["weighted ecl"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )

        # ADD TOTAL ROW
        total_row = df.select_dtypes(include='number').sum()
        total_row["aging category"] = "TOTAL"

        df = pd.concat([df, pd.DataFrame([total_row])], ignore_index=True)
        

        # Compute ECL RATE row
        total_loan_balance = df.loc[df["aging category"] == "TOTAL", "loan balance"].values[0]
        total_weighted_ecl = df.loc[df["aging category"] == "TOTAL", "weighted ecl"].values[0]

        ecl_rate_value = total_loan_balance / total_weighted_ecl if total_weighted_ecl != 0 else 0

        # Create row with only aging category + ecl rate
        ecl_rate_row = {
            "aging category": "ECL RATE",
            "count": ecl_rate_value
        }

        # Append row
        df = pd.concat([df, pd.DataFrame([ecl_rate_row])], ignore_index=True)
        return df
        
    except Exception:
        traceback.print_exc()
        return None	