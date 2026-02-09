import pandas as pd
import traceback	

import json

def process_summary_data(aging_report_file, credit_loss_rates_file, ecl_file, total_loan_balance, probability_weights, buckets):
    try:
        # Read aging report to get buckets
        aging_report_df = pd.read_excel(aging_report_file)
        aging_report_df.columns = aging_report_df.columns.str.strip().str.lower()
        print('buckets \n', buckets)

        # Read credit loss rates file to extract probability weights
        # Excel formula references: '01.01| Credit Loss Rates'!$D$34:$F$34
        # Look for probability weights by matching column names and aging category values
        credit_loss_rates_df = pd.read_excel(credit_loss_rates_file)
        credit_loss_rates_df.columns = credit_loss_rates_df.columns.str.strip().str.lower()
        
        try:
            weights = json.loads(probability_weights) if isinstance(probability_weights, str) else probability_weights
            weights = {
                k: float(v) / 100
                for k, v in weights.items()
            }
        except (json.JSONDecodeError, TypeError):
            weights = {"upside": 0.0, "baseline": 0.0, "downside": 0.0}

        print('weights', weights)
        
        # Look for weights by searching for rows with specific aging category patterns
        # Common patterns: "probability", "weight", "prob", or similar keywords
        if "aging category" in credit_loss_rates_df.columns:
            # Convert aging category to string for searching
            credit_loss_rates_df["aging category"] = credit_loss_rates_df["aging category"].astype(str).str.lower()
            
            # Search for rows with probability/weight keywords in aging category
            prob_rows = credit_loss_rates_df[
                credit_loss_rates_df["aging category"].str.contains("prob|weight|upside.*baseline.*downside", na=False, case=False, regex=True)
            ]
            
            if len(prob_rows) > 0:
                row = prob_rows.iloc[0]
                # Extract weights from upside, baseline, downside columns
                if "upside" in credit_loss_rates_df.columns and pd.notna(row.get("upside")):
                    weights["upside"] = float(row["upside"])
                if "baseline" in credit_loss_rates_df.columns and pd.notna(row.get("baseline")):
                    weights["baseline"] = float(row["baseline"])
                if "downside" in credit_loss_rates_df.columns and pd.notna(row.get("downside")):
                    weights["downside"] = float(row["downside"])
        
        # If weights still not found, try looking for a row where aging category is empty/NaN
        # but has values in upside, baseline, downside columns (might be a header row or summary row)
        if sum(weights.values()) == 0 and "aging category" in credit_loss_rates_df.columns:
            # Look for rows where aging category is NaN, empty, or contains summary keywords
            summary_rows = credit_loss_rates_df[
                (credit_loss_rates_df["aging category"].isna()) |
                (credit_loss_rates_df["aging category"] == "") |
                (credit_loss_rates_df["aging category"].str.contains("total|summary|all", na=False, case=False))
            ]
            
            if len(summary_rows) > 0:
                # Check if any of these rows have valid weight values
                for _, row in summary_rows.iterrows():
                    if "upside" in credit_loss_rates_df.columns and "baseline" in credit_loss_rates_df.columns and "downside" in credit_loss_rates_df.columns:
                        upside_val = row.get("upside")
                        baseline_val = row.get("baseline")
                        downside_val = row.get("downside")
                        
                        # Check if all three values are numeric and non-zero
                        if (pd.notna(upside_val) and pd.notna(baseline_val) and pd.notna(downside_val)):
                            try:
                                upside_float = float(upside_val)
                                baseline_float = float(baseline_val)
                                downside_float = float(downside_val)
                                
                                # If values look like probabilities (between 0 and 1) and sum to ~1, use them
                                if (0 <= upside_float <= 1 and 0 <= baseline_float <= 1 and 0 <= downside_float <= 1 and
                                    abs(upside_float + baseline_float + downside_float - 1.0) < 0.1):
                                    weights["upside"] = upside_float
                                    weights["baseline"] = baseline_float
                                    weights["downside"] = downside_float
                                    break
                            except (ValueError, TypeError):
                                continue
        
        print('weights \n', weights)

        # Read ECL file
        ecl_df = pd.read_excel(ecl_file)
        ecl_df.columns = ecl_df.columns.str.strip().str.lower()
        
        # Create summary DataFrame with aging categories
        df = pd.DataFrame({'aging category': buckets})

        # Identify "0 day" category early (if exists)
        zero_day_category = None
        for b in buckets:
            if "0 day" in str(b).lower() or "0day" in str(b).lower():
                zero_day_category = b
                break

        # Filter ECL data to exclude "0 day" if it exists (since "0 day" is calculated as residual)
        # "0 day" represents current/non-delinquent loans, which may not be in ECL file
        ecl_df_par_only = ecl_df.copy()
        if zero_day_category:
            # Remove any rows that might have "0 day" as aging category (if they exist)
            ecl_df_par_only = ecl_df_par_only[
                ~ecl_df_par_only["aging category"].astype(str).str.lower().str.contains("0 day|0day", na=False, case=False)
            ]

        # Count occurrences of each Aging Category in ecl_df (PAR categories only)
        aging_counts = ecl_df_par_only["aging category"].value_counts()
        print('aging_counts \n', aging_counts)
        
        # Map counts back into df (only for PAR categories, "0 day" will be calculated separately)
        df["count"] = df["aging category"].map(aging_counts).fillna(0).astype(int)

        # Sum loan balance per Aging Category in ecl_df (PAR categories only)
        aging_sums = ecl_df_par_only.groupby("aging category")["loan_balance"].sum()
        df["loan balance"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )
        
        # Sum expected credit loss upside per Aging Category (PAR categories only)
        aging_sums = ecl_df_par_only.groupby("aging category")["expected credit loss upside"].sum()
        df["expected credit loss upside"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )
        
        # Sum expected credit loss baseline per Aging Category (PAR categories only)
        aging_sums = ecl_df_par_only.groupby("aging category")["expected credit loss baseline"].sum()
        df["expected credit loss baseline"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )
        
        # Sum expected credit loss downside per Aging Category (PAR categories only)
        aging_sums = ecl_df_par_only.groupby("aging category")["expected credit loss downside"].sum()
        df["expected credit loss downside"] = (
            df["aging category"]
            .map(aging_sums)
            .fillna(0)
            .astype(float)
        )

        # Calculate Weighted ECL using SUMPRODUCT formula (for PAR categories)
        # Excel: =SUMPRODUCT($F10:$H10,'01.01| Credit Loss Rates'!$D$34:$F$34)
        # Formula: (upside * weight_upside) + (baseline * weight_baseline) + (downside * weight_downside)
        df["weighted ecl"] = (
            df["expected credit loss upside"] * weights["upside"] +
            df["expected credit loss baseline"] * weights["baseline"] +
            df["expected credit loss downside"] * weights["downside"]
        )

        # Calculate "0 day" as residual (if exists)
        if zero_day_category:
            # Calculate sum of all PAR category loan balances
            par_loan_balance_sum = df[df["aging category"] != zero_day_category]["loan balance"].sum()
            
            # "0 day" loan balance = Total Loan Balance - SUM(all PAR category loan balances)
            zero_day_loan_balance = total_loan_balance - par_loan_balance_sum
            
            # Calculate sum of all PAR category counts
            par_count_sum = df[df["aging category"] != zero_day_category]["count"].sum()
            total_count_from_ecl = len(ecl_df)
            
            # "0 day" count = Total count - SUM(all PAR category counts)
            zero_day_count = max(0, total_count_from_ecl - par_count_sum)
            
            # Update "0 day" row in DataFrame
            zero_day_idx = df[df["aging category"] == zero_day_category].index
            if len(zero_day_idx) > 0:
                df.loc[zero_day_idx[0], "loan balance"] = zero_day_loan_balance
                df.loc[zero_day_idx[0], "count"] = zero_day_count
                # "0 day" loans are current/non-delinquent, so ECL values should be 0
                df.loc[zero_day_idx[0], "expected credit loss upside"] = zero_day_loan_balance * credit_loss_rates_df["upside"].iloc[0]
                df.loc[zero_day_idx[0], "expected credit loss baseline"] = zero_day_loan_balance * credit_loss_rates_df["baseline"].iloc[0]
                df.loc[zero_day_idx[0], "expected credit loss downside"] = zero_day_loan_balance * credit_loss_rates_df["downside"].iloc[0]
                df.loc[zero_day_idx[0], "weighted ecl"] = df.loc[zero_day_idx[0], "expected credit loss upside"] * weights["upside"] + df.loc[zero_day_idx[0], "expected credit loss baseline"] * weights["baseline"] + df.loc[zero_day_idx[0], "expected credit loss downside"] * weights["downside"]

        # ADD TOTAL ROW (before calculating distribution)
        total_row = df.select_dtypes(include='number').sum()
        total_row["aging category"] = "TOTAL"
        total_loan_balance_from_data = total_row["loan balance"]

        # Calculate Distribution = Loan Balance / Total Loan Balance (as percentage)
        df["distribution"] = (df["loan balance"] / total_loan_balance_from_data * 100).fillna(0).astype(float)
        
        # For TOTAL row, distribution should be 100%
        total_row["distribution"] = 100.0

        df = pd.concat([df, pd.DataFrame([total_row])], ignore_index=True)

        # Compute ECL RATE row
        # Excel stores it in "count" column
        # Formula: (total_weighted_ecl / total_loan_balance) * 100 (as percentage)
        total_weighted_ecl = df.loc[df["aging category"] == "TOTAL", "weighted ecl"].values[0]
        ecl_rate_value = (total_weighted_ecl / total_loan_balance_from_data) if total_loan_balance_from_data != 0 else 0

        # Create ECL RATE row
        ecl_rate_row = {
            "aging category": "ECL RATE",
            "count": 0.0,
            "loan balance": 0.0,
            "distribution": 0.0,
            "expected credit loss upside": 0.0,
            "expected credit loss baseline": 0.0,
            "expected credit loss downside": 0.0,
            "weighted ecl": ecl_rate_value
        }

        # Append row
        df = pd.concat([df, pd.DataFrame([ecl_rate_row])], ignore_index=True)
        
        # Ensure column order matches UI expectations
        column_order = [
            "aging category",
            "count",
            "loan balance",
            "distribution",
            "expected credit loss upside",
            "expected credit loss baseline",
            "expected credit loss downside",
            "weighted ecl"
        ]
        df = df[column_order]
        
        return df
        
    except Exception:
        traceback.print_exc()
        return None	