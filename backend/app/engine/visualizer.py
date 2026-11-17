import pandas as pd
import numpy as np
from typing import List, Dict, Any

def recommend_visualizations(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Intelligently inspects column semantic types and correlations
    to recommend the best charts (time series, category comparison, scatter, box plots).
    """
    charts = []
    
    # 1. Identify date, numeric, and categorical columns
    date_cols = []
    numeric_cols = []
    category_cols = []

    for col in df.columns:
        s = df[col]
        if pd.api.types.is_datetime64_any_dtype(s) or 'date' in col.lower() or 'day' in col.lower():
            date_cols.append(col)
        elif pd.api.types.is_numeric_dtype(s):
            numeric_cols.append(col)
        elif s.nunique() <= 15:
            category_cols.append(col)

    # 2. Recommendation A: Time Series Line Chart
    if date_cols and numeric_cols:
        d_col = date_cols[0]
        n_col = numeric_cols[0]
        
        # Aggregate by date (take daily mean to keep clean chart points)
        temp_df = df[[d_col, n_col]].dropna().copy()
        temp_df[d_col] = temp_df[d_col].astype(str)
        agg = temp_df.groupby(d_col)[n_col].mean().reset_index()
        # Sort chronologically and take up to 40 points
        agg = agg.sort_values(by=d_col).tail(40)
        
        data_points = []
        for _, r in agg.iterrows():
            data_points.append({
                "x": str(r[d_col]),
                "y": round(float(r[n_col]), 2)
            })
            
        charts.append({
            "id": f"chart_ts_{n_col}",
            "title": f"Chronological Trend: Average {n_col.replace('_', ' ')}",
            "type": "line",
            "x_axis": d_col,
            "y_axis": n_col,
            "data": data_points,
            "description": f"Displays the temporal progression and fluctuations of {n_col} over recorded dates."
        })

    # 3. Recommendation B: Category Comparison Bar Chart
    if category_cols and numeric_cols:
        cat_col = category_cols[0]
        n_col = numeric_cols[0]
        
        temp_df = df[[cat_col, n_col]].dropna()
        agg = temp_df.groupby(cat_col)[n_col].mean().reset_index()
        agg = agg.sort_values(by=n_col, ascending=False).head(10)
        
        data_points = []
        for _, r in agg.iterrows():
            data_points.append({
                "category": str(r[cat_col]),
                "value": round(float(r[n_col]), 2)
            })
            
        charts.append({
            "id": f"chart_bar_{cat_col}_{n_col}",
            "title": f"Performance Benchmark: {n_col.replace('_', ' ')} by {cat_col.replace('_', ' ')}",
            "type": "bar",
            "x_axis": cat_col,
            "y_axis": n_col,
            "data": data_points,
            "description": f"Compares mean {n_col} across various {cat_col} operating groups."
        })

    # 4. Recommendation C: Multi-Metric Scatter / Relationship
    if len(numeric_cols) >= 2:
        x_col = numeric_cols[0]
        y_col = numeric_cols[1]
        
        sample_df = df[[x_col, y_col]].dropna().head(100)
        data_points = []
        for _, r in sample_df.iterrows():
            data_points.append({
                "x": round(float(r[x_col]), 2),
                "y": round(float(r[y_col]), 2)
            })
            
        charts.append({
            "id": f"chart_scatter_{x_col}_{y_col}",
            "title": f"Correlation Analysis: {x_col.replace('_', ' ')} vs {y_col.replace('_', ' ')}",
            "type": "scatter",
            "x_axis": x_col,
            "y_axis": y_col,
            "data": data_points,
            "description": f"Explores relationships and outlier clusters between {x_col} and {y_col}."
        })

    return charts
