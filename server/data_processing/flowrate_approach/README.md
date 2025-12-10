# Flow Rate Approach Module

This module implements the flow rate calculation methodology for analyzing loan portfolio aging and credit loss rates. It processes aging reports to calculate flow rates and credit loss rates across different aging buckets.

## Overview

The flow rate approach analyzes how loans move through different aging buckets over time, calculating the probability of loans transitioning from one bucket to the next. This is used to estimate credit loss rates for Expected Credit Loss (ECL) calculations.

## Module Structure

### Files

- **`flowrate_approach.py`**: Main flow rate calculation logic
- **`creditloss_rate.py`**: Credit loss rate calculation based on flow rates
- **`__init__.py`**: Package initialization

## Process Flow

### Step 1: Flow Rate Calculation (`flowrate_approach.py`)

#### Main Function: `flow_rate_main(aging_report)`

**Input:**
- `aging_report`: An object containing `json_data` with loan balance matrix data

**Process:**
1. **Load and Prepare Data**
   - Parses JSON data from the aging report
   - Converts timestamps to YYYY-MM-DD format
   - Creates a DataFrame with loan balances across aging buckets

2. **Calculate Distribution Matrix**
   - Calls `calculate_flow_of_loan_balance_principal_matrix_dist()`
   - Converts absolute loan balances to percentage distributions
   - Each bucket's balance is divided by the total loan balance

3. **Calculate Flow Rates**
   - Calls `calculate_flow_rate()`
   - For each aging bucket, calculates the ratio of loans that "flow" from the previous period's next bucket to the current period's current bucket
   - Formula: `previous_row_next_column / current_row_current_column`
   - Flow rates are capped at 1.0 (100%)
   - The last bucket (PAR 360+) is always set to 1.0

**Output:**
Returns a dictionary with three DataFrames:
- `Flow of Loan Balance Principal Matrix`: Original loan balance data
- `Flow of Loan Balance Principal Matrix (Distribution)`: Percentage distribution of balances
- `Flow Rate Calculation`: Flow rates for each bucket and date

#### Function: `calculate_flow_of_loan_balance_principal_matrix_dist(loan_balance_matrix_df)`

Converts absolute loan balances to percentage distributions.

**Process:**
- For each bucket column (excluding 'date' and 'total loan balance with c/p'):
  - Divides bucket balance by total loan balance
  - Results in percentage distribution (0.0 to 1.0)
- Recalculates total to ensure it sums to 1.0

#### Function: `calculate_flow_rate(flow_of_loan_balance_principal_matrix_dist_df)`

Calculates the flow rate for each aging bucket.

**Process:**
- For each row (starting from row 1, skipping the first row):
  - For each bucket column:
    - Gets the value from the previous row's next bucket
    - Divides by the current row's current bucket value
    - Result is the flow rate (capped at 1.0)
  - Special case: PAR 360+ bucket is always 1.0
  - Handles division by zero (returns 1.0 if denominator is 0)

### Step 2: Credit Loss Rate Calculation (`creditloss_rate.py`)

#### Main Function: `creditloss_rate_main(flowrate_output_data)`

**Input:**
- `flowrate_output_data`: Dictionary containing the output from `flow_rate_main()`

**Process:**
1. **Load Flow Rate Data**
   - Extracts the three DataFrames from flowrate output
   - Validates required columns exist

2. **Calculate Aging Buckets**
   - Calls `calculate_aging_buckets()`
   - Computes tail products (cumulative flow rate products)
   - Calculates weighted credit loss rates
   - Checks monotonicity (strictly increasing values)

3. **Return Results**
   - Returns DataFrame with tail products, monotonicity check, and weighted credit loss rates
   - Includes an "Average" row with mean values

**Output:**
Returns a dictionary with:
- `code`: Status code (1 for success, -1 for error)
- `success`: Boolean indicating success
- `msg`: Status message
- `data`: DataFrame with aging bucket calculations

#### Function: `calculate_aging_buckets(flow_of_loan_balance_principal_matrix_dist, flow_rate)`

Calculates tail products and weighted credit loss rates.

**Process:**
1. **Calculate Tail Products**
   - For each row, calculates offset products (tail products) for each bucket
   - Tail product for bucket `i` = product of flow rates from bucket `i` to the end
   - Example: For bucket 0, product = flow_rate[0] × flow_rate[1] × ... × flow_rate[8]
   - Uses `_offset_products()` helper function
   - Ignores zero and NaN values (treats as 1.0)

2. **Check Monotonicity**
   - Verifies that tail products are strictly increasing
   - Uses `_strictly_increasing()` helper function
   - Returns "Yes" if strictly increasing, "No" otherwise

3. **Calculate Weighted Credit Loss Rate**
   - For each date:
     - Gets tail products (credit loss rates) for that date
     - Gets distribution percentages (weights) from the distribution matrix
     - Calculates SUMPRODUCT: `sum(tail_product[i] × dist_weight[i])`
   - This gives the weighted average credit loss rate per month

4. **Add Average Row**
   - Calculates mean values for all numeric columns
   - Adds an "Average" row to the output

**Output:**
Returns DataFrame with:
- Date column
- 9 bucket columns (tail products for each bucket)
- "Monotonic?" column
- "Weighted Credit Loss Rate per Month" column
- Average row

#### Helper Functions

**`_offset_products(row_vals)`**
- Calculates tail products for a single row
- For each bucket position, calculates the product of flow rates from that position to the end
- Returns a list of 9 tail product values

**`_safe_prod_nonzero(arr)`**
- Calculates product of non-zero, non-NaN values
- Returns 1.0 if all values are zero or NaN (Excel PRODUCT(IF(...)) behavior)

**`_strictly_increasing(vals)`**
- Checks if a list of values is strictly increasing
- Returns True if each value is less than the next value

#### Function: `calculate_aging_category()` (Currently Commented Out)

This function calculates aging category tables but is currently not in use. It would:
- Extract average values from aging buckets
- Calculate historical credit loss rates
- Apply scalar adjustments
- Calculate forward-looking credit loss rates

## Aging Buckets

The module uses 9 standard aging buckets:

1. **0 day to PAR 1**: Current/Performing loans
2. **PAR 1 to PAR 30**: 1-30 days past due
3. **PAR 30 to PAR 60**: 31-60 days past due
4. **PAR 60 to PAR 90**: 61-90 days past due
5. **PAR 90 to PAR 120**: 91-120 days past due
6. **PAR 120 to PAR 180**: 121-180 days past due
7. **PAR 180 to PAR 240**: 181-240 days past due
8. **PAR 240 to PAR 360**: 241-360 days past due
9. **PAR 360 above**: 361+ days past due (write-off bucket)

## Data Flow

```
Aging Report (JSON)
    ↓
flow_rate_main()
    ↓
[Flow of Loan Balance Principal Matrix]
[Flow of Loan Balance Principal Matrix (Distribution)]
[Flow Rate Calculation]
    ↓
creditloss_rate_main()
    ↓
[Aging Buckets with Tail Products]
[Weighted Credit Loss Rate per Month]
[Monotonicity Check]
```

## Key Concepts

### Flow Rate
The probability that a loan in a specific bucket will remain in that bucket or move to the next bucket. It's calculated as the ratio of loans that "survived" from the previous period.

### Tail Products
Cumulative flow rate products representing the probability that a loan will reach a certain aging stage. Higher tail products indicate higher credit loss risk.

### Weighted Credit Loss Rate
The expected credit loss rate weighted by the distribution of loan balances across aging buckets. This gives a portfolio-level credit loss estimate.

### Monotonicity
Tail products should be strictly increasing (each bucket should have a higher tail product than the previous). This ensures logical progression of credit risk.

## Error Handling

- Both modules include try-except blocks with traceback printing
- Returns error codes and messages in standardized format
- Validates required columns before processing
- Handles division by zero and NaN values gracefully

## Dependencies

- `pandas`: Data manipulation
- `numpy`: Numerical operations
- `helpers.timestamp_converter`: Date conversion utilities
- `helpers.routers.rename_bucket_cols`: Column renaming utilities

## Usage Example

```python
from data_processing.flowrate_approach.flowrate_approach import flow_rate_main
from data_processing.flowrate_approach.creditloss_rate import creditloss_rate_main

# Step 1: Calculate flow rates
flowrate_output = flow_rate_main(aging_report)

# Step 2: Calculate credit loss rates
credit_loss_output = creditloss_rate_main(flowrate_output)
```

## Notes

- The module assumes data is sorted by date chronologically
- First row is typically skipped for flow rate calculations (no previous period)
- PAR 360+ bucket always has a flow rate of 1.0 (100% loss)
- All calculations handle edge cases like zero balances and missing data

