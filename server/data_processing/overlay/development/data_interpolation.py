import pandas as pd
import numpy as np
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')


def process_data_interpolation(quarterly_hist_mev_df: pd.DataFrame):
    """
    Process quarterly data and generate monthly interpolated data with proper x-based start date
    """
    # Month names mapping for dynamic date handling
    month_names = {1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
                  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'}
    
    print("="*60)
    print("PROPER QUARTERLY TO MONTHLY INTERPOLATION GENERATOR")
    print("="*60)
    
    # File paths
    input_file = "data/ecl/development/New Microsoft Excel Worksheet.csv"
    output_dir = "data/ecl/development"
    
    # Check if input file exists
    # if not os.path.exists(input_file):
    #     print(f"❌ Error: Input file not found: {input_file}")
    #     return None
    
    try:
        # Step 1: Load and clean the data
        print("\n📁 Step 1: Loading and cleaning quarterly data...")
        

        df = quarterly_hist_mev_df.copy()
        df.columns = df.columns.str.strip().str.lower()
        
        # Step 2: Clean the data
        print("\n🧹 Step 2: Cleaning quarterly data...")
        
        # Store rows where Year is not numeric to add back later
        initial_rows = len(df)
        non_numeric_year_mask = pd.to_numeric(df['year'], errors='coerce').isna()
        non_numeric_rows = df[non_numeric_year_mask].copy()
        
        # Remove rows where Year is not numeric for processing
        df = df[pd.to_numeric(df['year'], errors='coerce').notna()]
        cleaned_rows = len(df)
        
        print(f"✅ Removed {initial_rows - cleaned_rows} rows with non-numeric years")
        print(f"📊 Stored {len(non_numeric_rows)} non-numeric year rows to add back later")
        
        # Convert Year to integer
        df['year'] = df['year'].astype(int)
        
        # Convert Quarter to numeric (1,2,3,4 representing Q1,Q2,Q3,Q4)
        if 'quarter' in df.columns:
            df['quarter'] = pd.to_numeric(df['quarter'], errors='coerce')
            # Remove rows where Quarter is NaN after conversion
            df = df.dropna(subset=['quarter'])
            # Ensure Quarter values are valid (1,2,3,4)
            df = df[df['quarter'].isin([1, 2, 3, 4])]
        
        # Convert Month to numeric if it exists
        if 'month' in df.columns:
            df['month'] = pd.to_numeric(df['month'], errors='coerce')
        
        # Convert all columns that should be numeric to numeric
        # Skip Year, Quarter, Month, ID, x columns
        skip_cols = ['year', 'quarter', 'month', 'id', 'x']
        for col in df.columns:
            if col not in skip_cols:
                # Check if column contains percentage values (has % symbols)
                sample_values = df[col].dropna().astype(str).head(10)
                has_percentage = any('%' in str(val) for val in sample_values)
                
                if has_percentage:
                    # Remove % symbol and convert to numeric
                    print(f"      🎯 Processing percentage column: {col}")
                    df[col] = df[col].astype(str).str.replace('%', '').str.strip()
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                else:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Get numeric columns after conversion
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        # Remove rows where all numeric values are NaN
        df = df.dropna(subset=numeric_columns, how='all')
        
        print(f"📊 Final cleaned quarterly data shape: {df.shape}")
        print(f"📅 Date range: {df['year'].min()}-{df['year'].max()}")
        
        # Show sample of quarterly data
        print(f"📋 Sample quarterly data:")
        print(df[['year', 'quarter', 'id', 'x']].head(10))
        
        # Step 3: Find the first quarter where x is not empty/NaN
        print("\n🔍 Step 3: Finding first quarter with x value...")
        
        # Find the first row where x is not NaN/empty
        first_x_row = None
        for idx, row in df.iterrows():
            if pd.notna(row['x']) and str(row['x']).strip() != '':
                first_x_row = row
                break
        
        if first_x_row is None:
            print("❌ Error: Could not find any row with x value")
            return None
        
        first_year = first_x_row['year']
        first_quarter = first_x_row['quarter']
        first_x_value = first_x_row['x']
        
        # Convert quarter to month (Q1=Mar=3, Q2=Jun=6, Q3=Sep=9, Q4=Dec=12)
        quarter_to_month = {1: 3, 2: 6, 3: 9, 4: 12}
        first_month = quarter_to_month[first_quarter]
        
        print(f"✅ First quarter with x value: {first_year} Q{first_quarter} (Month {first_month}) with x={first_x_value}")
        
        # Step 4: Create monthly index for ALL months from 2012-01 to 2024-12
        print("\n📅 Step 4: Creating monthly index for all months...")
        
        start_year = df['year'].min()
        end_year = df['year'].max()
        
        # Create monthly date range for ALL months
        monthly_dates = pd.date_range(
            start=f"{start_year}-01-01",
            end=f"{end_year}-12-31",
            freq='MS'  # Month start
        )
        
        print(f"✅ Created monthly index: {len(monthly_dates)} months")
        print(f"📅 From {monthly_dates[0].strftime('%Y-%m')} to {monthly_dates[-1].strftime('%Y-%m')}")
        
        # Step 5: Create monthly DataFrame
        print("\n🔄 Step 5: Creating monthly DataFrame...")
        
        monthly_df = pd.DataFrame(index=monthly_dates)
        monthly_df['year'] = monthly_df.index.year
        monthly_df['month'] = monthly_df.index.month
        monthly_df['quarter'] = monthly_df.index.quarter
        monthly_df['id'] = monthly_df['year'].astype(str) + '-' + monthly_df.index.strftime('%b')
        
        # Set x column to start from 0 at the first data date and increment by 0.1
        monthly_df['x'] = 0.0
        first_data_date_idx = monthly_df.index[monthly_df.index >= f"{first_year}-{first_month:02d}-01"][0]
        first_data_row_idx = monthly_df.index.get_loc(first_data_date_idx)
        
        # Set x values starting from the first data date
        for i in range(first_data_row_idx, len(monthly_df)):
            monthly_df['x'].iloc[i] = (i - first_data_row_idx) * 0.1
        
        # Step 6: Interpolate quarterly data to monthly
        print("\n📈 Step 6: Interpolating quarterly to monthly data...")
        
        # Get numeric columns (excluding Year, Quarter, Month, ID, x and unnamed columns)
        numeric_cols = [col for col in df.columns 
                       if col not in ['year', 'quarter', 'month', 'id', 'x'] and 
                       not str(col).lower().startswith('unnamed') and
                       pd.api.types.is_numeric_dtype(df[col])]
        
        print(f"📊 Found {len(numeric_cols)} numeric columns to interpolate:")
        for i, col in enumerate(numeric_cols, 1):
            print(f"   {i:2d}. {col}")
        
        # Remove duplicate rows based on Year and Quarter
        df_clean = df.drop_duplicates(subset=['year', 'quarter'], keep='first')
        print(f"📊 Removed {len(df) - len(df_clean)} duplicate rows")
        
        # For each numeric column, interpolate from quarterly to monthly
        for col in numeric_cols:
            print(f"   🔄 Interpolating: {col}")
            
            # Create quarterly series with proper dates
            quarterly_temp = df_clean[['year', 'quarter', col]].copy()
            
            # Convert quarter to month (Q1=Mar=3, Q2=Jun=6, Q3=Sep=9, Q4=Dec=12)
            quarterly_temp['month'] = quarterly_temp['quarter'].map(quarter_to_month).astype(int)
            quarterly_temp['day'] = 1  # Set day to 1
            
            # Create date string and convert to datetime
            quarterly_temp['date'] = pd.to_datetime(
                quarterly_temp['year'].astype(str) + '-' + 
                quarterly_temp['month'].astype(str) + '-' + 
                quarterly_temp['day'].astype(str)
            )
            quarterly_temp = quarterly_temp.set_index('date')
            
            # Reindex to monthly and interpolate
            monthly_series = quarterly_temp[col].reindex(monthly_dates)
            monthly_series = monthly_series.interpolate(method='linear')
            monthly_series = monthly_series.fillna(method='ffill').fillna(method='bfill')
            
            # All variables start from 2012-Dec (Q4) where x begins
            first_data_date = f"{first_year}-{first_month:02d}-01"
            
            monthly_series.loc[monthly_series.index < first_data_date] = 0
            
            monthly_df[col] = monthly_series.values
        
        # Reorder columns
        column_order = ['year', 'quarter', 'month', 'id', 'x'] + numeric_cols
        monthly_df = monthly_df[column_order]
        
        print(f"✅ Interpolation complete!")
        print(f"📊 Monthly data shape: {monthly_df.shape}")
        
        # Show sample of interpolated data
        print(f"📋 Sample interpolated monthly data:")
        print(monthly_df[['year', 'month', 'id', 'x']].head(15))
        
        # Step 7: Calculate growth rates
        print("\n📊 Step 7: Calculating growth rates...")
        
        monthly_with_growth = monthly_df.copy()
        
        # Calculate growth rates only for data starting from the first data date
        first_data_date_idx = monthly_df.index[monthly_df.index >= f"{first_year}-{first_month:02d}-01"][0]
        first_data_row_idx = monthly_df.index.get_loc(first_data_date_idx)
        
        print(f"📅 Growth rate calculation starts from: {first_data_date_idx.strftime('%Y-%m')} (row {first_data_row_idx})")
        
        for col in numeric_cols:
            growth_col = f"{col}_growth_12m"
            
            # Initialize growth column with NaN
            monthly_with_growth[growth_col] = np.nan
            
            # Calculate growth rates only for rows where we have 12 months of previous data
            for i in range(first_data_row_idx + 12, len(monthly_with_growth)):
                current_val = monthly_with_growth[col].iloc[i]
                prev_val = monthly_with_growth[col].iloc[i-12]
                
                # Only calculate if both current and previous values are not zero/NaN
                if pd.notna(current_val) and pd.notna(prev_val) and prev_val != 0:
                    monthly_with_growth[growth_col].iloc[i] = (
                        (current_val - prev_val) / prev_val * 100
                    )
                else:
                    monthly_with_growth[growth_col].iloc[i] = 0
        
        print(f"✅ Added 12-month growth rates for {len(numeric_cols)} variables")
        print(f"📊 Growth rates calculated from row {first_data_row_idx + 12} onwards")
        
        # Step 8: Save output files
        print("\n💾 Step 8: Saving output files...")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save basic monthly data
        csv_basic = os.path.join(output_dir, f"monthly_interpolated_data_proper_{timestamp}.csv")
        excel_basic = os.path.join(output_dir, f"monthly_interpolated_data_proper_{timestamp}.xlsx")
        
        # monthly_df.to_csv(csv_basic, index=False)
        # monthly_df.to_excel(excel_basic, index=False, sheet_name='Monthly_Data')
        
        # Save data with growth rates
        csv_growth = os.path.join(output_dir, f"monthly_interpolated_data_with_growth_proper_{timestamp}.csv")
        excel_growth = os.path.join(output_dir, f"monthly_interpolated_data_with_growth_proper_{timestamp}.xlsx")
        
        # monthly_with_growth.to_csv(csv_growth, index=False)
        # monthly_with_growth.to_excel(excel_growth, index=False, sheet_name='Monthly_Data_With_Growth')
        
        print(f"✅ Files saved:")
        print(f"   📄 Basic data (CSV): {csv_basic}")
        print(f"   📊 Basic data (Excel): {excel_basic}")
        print(f"   📄 With growth (CSV): {csv_growth}")
        print(f"   📊 With growth (Excel): {excel_growth}")
        
        # Step 9: Generate summary
        print("\n📋 Step 9: Summary Report")
        print("="*60)
        print(f"📁 Input file: {input_file}")
        print(f"📅 Processing date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📊 Quarterly data rows: {len(df)}")
        print(f"📊 Monthly data rows: {len(monthly_df)}")
        print(f"📅 Date range: {start_year}-{end_year}")
        print(f"📅 First quarter with x value: {first_year} Q{first_quarter} (Month {first_month}) with x={first_x_value}")
        print(f"📈 Variables interpolated: {len(numeric_cols)}")
        print(f"🔄 Interpolation method: Linear interpolation (Quarterly to Monthly)")
        print(f"📊 Growth rate period: 12 months (Year-over-Year)")
        print(f"🔢 Months with zero values: {first_month - 1} months before first x value")
        
        # Verify specific data points
        print(f"\n🔍 Data Verification:")
        # Dynamic verification - check first month, month before start, and start month
        first_month_id = f"{start_year}-Jan"
        month_before_start_id = f"{first_year}-{month_names[first_month-1] if first_month > 1 else 12}"
        start_month_id = f"{first_year}-{month_names[first_month]}"
        
        print(f"   {first_month_id}: x={monthly_df[monthly_df['id']==first_month_id]['x'].iloc[0] if first_month_id in monthly_df['id'].values else 'Not found'}")
        print(f"   {first_month_id}: GDP={monthly_df[monthly_df['id']==first_month_id]['gdp'].iloc[0] if first_month_id in monthly_df['id'].values else 'Not found'}")
        print(f"   {month_before_start_id}: x={monthly_df[monthly_df['id']==month_before_start_id]['x'].iloc[0] if month_before_start_id in monthly_df['id'].values else 'Not found'}")
        print(f"   {month_before_start_id}: GDP={monthly_df[monthly_df['id']==month_before_start_id]['gdp'].iloc[0] if month_before_start_id in monthly_df['id'].values else 'Not found'}")
        print(f"   {start_month_id}: x={monthly_df[monthly_df['id']==start_month_id]['x'].iloc[0] if start_month_id in monthly_df['id'].values else 'Not found'}")
        print(f"   {start_month_id}: GDP={monthly_df[monthly_df['id']==start_month_id]['gdp'].iloc[0] if start_month_id in monthly_df['id'].values else 'Not found'}")
        # Dynamic verification based on actual data
        first_data_id_formatted = f"{first_year}-{month_names[first_month]}"
        
        if first_data_id_formatted in monthly_df['id'].values:
            first_data_row = monthly_df[monthly_df['id']==first_data_id_formatted]
            print(f"   {first_data_id_formatted}: GNI={first_data_row['gni'].iloc[0]:,.2f}")
            print(f"   {first_data_id_formatted}: Unemployment Rate={first_data_row['unemp_rate'].iloc[0]:.3f}")
        
        # Check unemployment rate for the month before start date (should be 0)
        prev_month = first_month - 1 if first_month > 1 else 12
        prev_year = first_year if first_month > 1 else first_year - 1
        prev_month_id = f"{prev_year}-{month_names[prev_month]}"
        
        if prev_month_id in monthly_df['id'].values:
            prev_row = monthly_df[monthly_df['id']==prev_month_id]
            print(f"   {prev_month_id}: Unemployment Rate={prev_row['unemp_rate'].iloc[0]:.3f}")
        
        print("\n" + "="*60)
        print("🎉 SUCCESS: Proper monthly interpolated data generated!")
        print("="*60)
        
        # Clean and convert DataFrames for JSON serialization
        monthly_df_clean = monthly_df.replace([np.inf, -np.inf], 0).fillna(0)
        monthly_with_growth_clean = monthly_with_growth.replace([np.inf, -np.inf], 0).fillna(0)
        
        # Add back the non-numeric year rows to the final output
        if len(non_numeric_rows) > 0:
            print(f"\n🔄 Adding back {len(non_numeric_rows)} non-numeric year rows...")
            
            # Convert non_numeric_rows to the same format as monthly data
            # Add missing columns with default values
            for col in monthly_df_clean.columns:
                if col not in non_numeric_rows.columns:
                    non_numeric_rows[col] = 0  # Default value for missing columns
            
            # Reorder columns to match monthly_df_clean
            non_numeric_rows = non_numeric_rows[monthly_df_clean.columns]
            
            # Prepend to monthly_df_clean (add at the top)
            monthly_df_clean = pd.concat([non_numeric_rows, monthly_df_clean], ignore_index=True)
            
            # For monthly_with_growth_clean, add the same rows but with growth columns set to 0
            non_numeric_rows_growth = non_numeric_rows.copy()
            for col in monthly_with_growth_clean.columns:
                if col not in non_numeric_rows_growth.columns:
                    non_numeric_rows_growth[col] = 0  # Default value for missing columns
            
            # Reorder columns to match monthly_with_growth_clean
            non_numeric_rows_growth = non_numeric_rows_growth[monthly_with_growth_clean.columns]
            
            # Prepend to monthly_with_growth_clean (add at the top)
            monthly_with_growth_clean = pd.concat([non_numeric_rows_growth, monthly_with_growth_clean], ignore_index=True)
            
            print(f"✅ Added back {len(non_numeric_rows)} rows to final output")
            print(f"📊 Final monthly_df_clean shape: {monthly_df_clean.shape}")
            print(f"📊 Final monthly_with_growth_clean shape: {monthly_with_growth_clean.shape}")

        return {
            'monthly_data': monthly_df_clean.to_dict(orient='records'),
            'monthly_with_growth': monthly_with_growth_clean.to_dict(orient='records'),
            'output_files': {
                'csv_basic': csv_basic,
                'excel_basic': excel_basic,
                'csv_growth': csv_growth,
                'excel_growth': excel_growth
            }
        }
        
    except Exception as e:
        print(f"❌ Error during processing: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
