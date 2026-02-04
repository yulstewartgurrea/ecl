import os
import tempfile
import unittest
import pandas as pd

from data_processing.overlay.development.filtering_models import filter_one_result_file


class TestFilteringModels(unittest.TestCase):
    def test_filter_logic_and_or(self):
        # Create a minimal MFA result file
        mfa_rows = pd.DataFrame([
            {
                "X1": "gdp",
                "X2": "gni",
                "R_Squared": 0.6,
                "MAPE": 0.2,
                "Adj_R_Squared": 0.5,
                "p-value_X1": 0.01,
                "vif_X1": 2.0,
            },
            {
                "X1": "gdp",
                "X2": "inflation",
                "R_Squared": 0.3,
                "MAPE": 0.6,
                "Adj_R_Squared": 0.2,
                "p-value_X1": 0.2,
                "vif_X1": 8.0,
            },
        ])

        combos_df = pd.DataFrame([
            {"X1": "gdp", "X2": "gni", "max_abs_cor": 0.7},
            {"X1": "gdp", "X2": "inflation", "max_abs_cor": 0.9},
        ])

        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "mfa.csv")
            mfa_rows.to_csv(path, index=False)

            filters = [
                {"column": "R_Squared", "value": "0.5", "operator": ">="},
                {"column": "MAPE", "value": "0.5", "operator": "<="},
            ]

            # AND logic should keep only the first row
            and_df = filter_one_result_file(
                fn=path,
                combos_df=combos_df,
                num_vars_taken=2,
                parsed_filter_list=filters,
                filter_logic="AND",
            )
            self.assertEqual(len(and_df), 1)
            self.assertEqual(and_df.iloc[0]["X2"], "gni")

            # OR logic should keep both rows (each satisfies at least one condition)
            or_df = filter_one_result_file(
                fn=path,
                combos_df=combos_df,
                num_vars_taken=2,
                parsed_filter_list=filters,
                filter_logic="OR",
            )
            self.assertEqual(len(or_df), 2)


if __name__ == "__main__":
    unittest.main()
