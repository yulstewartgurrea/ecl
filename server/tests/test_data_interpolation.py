import os
import tempfile
import unittest
import pandas as pd

from data_processing.overlay.execution.data_interpolation import process_data_interpolation


class TestDataInterpolation(unittest.TestCase):
    def test_quarter_date_parsing_and_missing_values(self):
        # Create a minimal quarterly dataset with quarter labels
        rows = [
            ["Date", "x", "gdp"],
            ["2012-Q1", "0.3", "1.0"],
            ["2012-Q2", "0.6", "2.0"],
        ]
        df = pd.DataFrame(rows)

        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "quarterly.csv")
            df.to_csv(path, index=False, header=False)

            out = process_data_interpolation(path)
            self.assertIsNotNone(out)

            # Expect January and February 2012 to remain NaN (no coercion to 0)
            jan = out[(out["year"] == 2012) & (out["month (int)"] == 1)]
            feb = out[(out["year"] == 2012) & (out["month (int)"] == 2)]
            self.assertEqual(len(jan), 1)
            self.assertEqual(len(feb), 1)
            self.assertTrue(pd.isna(jan["gdp"].iloc[0]))
            self.assertTrue(pd.isna(feb["gdp"].iloc[0]))


if __name__ == "__main__":
    unittest.main()
