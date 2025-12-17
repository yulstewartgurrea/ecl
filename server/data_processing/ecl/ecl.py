import pandas as pd
import traceback

def process_ecl_data(client_loan_balances_file, credit_loss_rates_file, parsed_probability_weights):
    try:
        client_loan_balances_df = pd.read_excel(client_loan_balances_file)
        credit_loss_rates_df = pd.read_excel(credit_loss_rates_file)

        df = client_loan_balances_df.copy()

        # Normalize column names
        df.columns = df.columns.str.strip().str.lower()
        credit_loss_rates_df.columns = credit_loss_rates_df.columns.str.strip().str.lower()

        # Validate required columns
        required_client_cols = {"aging category"}
        required_rates_cols = {"aging category", "upside", "baseline", "downside"}

        if not required_client_cols.issubset(df.columns):
            raise ValueError(f"Client file missing columns: {sorted(required_client_cols - set(df.columns))}")
        if not required_rates_cols.issubset(credit_loss_rates_df.columns):
            raise ValueError(f"Rates file missing columns: {sorted(required_rates_cols - set(credit_loss_rates_df.columns))}")

        # Normalize the key values
        df["aging category"] = df["aging category"].astype(str).str.strip().str.lower()
        credit_loss_rates_df["aging category"] = credit_loss_rates_df["aging category"].astype(str).str.strip().str.lower()

        # Ensure numeric scenario columns
        for col in ["upside", "baseline", "downside"]:
            credit_loss_rates_df[col] = pd.to_numeric(credit_loss_rates_df[col], errors="coerce")

        # Drop duplicates on key
        credit_loss_rates_df = credit_loss_rates_df.drop_duplicates(subset=["aging category"], keep="last")

        # Build lookup table (index=aging category, cols=scenarios)
        lookup = credit_loss_rates_df.set_index("aging category")[["upside", "baseline", "downside"]]

        # Map each scenario into df
        df["credit loss rate upside"] = df["aging category"].map(lookup["upside"])
        df["credit loss rate baseline"] = df["aging category"].map(lookup["baseline"])
        df["credit loss rate downside"] = df["aging category"].map(lookup["downside"])

        # Optional: fail fast if any didn't match
        missing_mask = (
            df["credit loss rate upside"].isna() |
            df["credit loss rate baseline"].isna() |
            df["credit loss rate downside"].isna()
        )
        if missing_mask.any():
            missing = df.loc[missing_mask, "aging category"].unique().tolist()
            raise ValueError(f"Unmatched Aging Category value(s): {missing[:20]}{'...' if len(missing) > 20 else ''}")

        df['expected credit loss upside'] = df['loan_balance'] * df['credit loss rate upside']
        df['expected credit loss baseline'] = df['loan_balance'] * df['credit loss rate baseline']
        df['expected credit loss downside'] = df['loan_balance'] * df['credit loss rate downside']
        # wighted ecl is =SUMPRODUCT($P7:$R7,'01.01| Credit Loss Rates'!$D$29:$F$29)
        df["weighted ecl"] = (
            df["expected credit loss upside"] * parsed_probability_weights["upside"] +
            df["expected credit loss baseline"] * parsed_probability_weights["baseline"] +
            df["expected credit loss downside"] * parsed_probability_weights["downside"]
        )

        return df

    except Exception:
        traceback.print_exc()
        return None