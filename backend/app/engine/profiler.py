import pandas as pd
import numpy as np
import math
from typing import Dict, Any, List, Optional

def infer_column_semantic_type(col_name: str, series: pd.Series) -> str:
    """
    Intelligently infer whether a column is:
    - 'id' (Unique identifier/key)
    - 'date' (Datetime / chronological)
    - 'numeric' (Continuous measurement / quantity / metric)
    - 'currency' (Financial amounts)
    - 'percentage' (Ratios, rates)
    - 'category' (Discrete low-cardinality groups)
    - 'text' (Freeform strings)
    """
    col_lower = str(col_name).lower()
    
    # Check ID patterns
    if col_lower.endswith('_id') or col_lower.endswith('id') or 'code' in col_lower:
        if series.nunique() > 0.7 * len(series.dropna()):
            return 'id'
            
    # Check Datetime patterns
    if 'date' in col_lower or 'time' in col_lower or 'day' in col_lower or 'year' in col_lower:
        if pd.api.types.is_datetime64_any_dtype(series):
            return 'date'
        # Try sample parse
        sample = series.dropna().head(10).astype(str)
        try:
            pd.to_datetime(sample)
            return 'date'
        except Exception:
            pass

    # Financial / Percentage naming clues
    if any(k in col_lower for k in ['usd', 'eur', 'cost', 'price', 'revenue', 'margin', 'amount', 'salary']):
        return 'currency'
    if any(k in col_lower for k in ['pct', 'percent', 'rate', 'ratio']):
        return 'percentage'

    # Numeric inspection
    if pd.api.types.is_numeric_dtype(series):
        # If integer with very low unique values, might be categorical
        if series.nunique() <= 5 and len(series) > 20:
            return 'category'
        return 'numeric'
        
    # Categorical vs Text
    unique_count = series.nunique()
    total_count = len(series.dropna())
    if total_count > 0 and (unique_count / total_count < 0.25 or unique_count <= 20):
        return 'category'
        
    return 'text'

def profile_dataset(df: pd.DataFrame, dataset_name: str = "Dataset") -> Dict[str, Any]:
    """
    Produces complete statistical profiling, data quality metrics,
    cardinality, missing value audits, and column classifications.
    """
    total_rows = len(df)
    total_cols = len(df.columns)
    duplicate_rows = int(df.duplicated().sum())
    
    columns_profile = []
    total_missing_cells = 0
    
    for col in df.columns:
        series = df[col]
        missing_count = int(series.isna().sum())
        total_missing_cells += missing_count
        missing_pct = round((missing_count / total_rows * 100), 2) if total_rows > 0 else 0
        unique_vals = int(series.nunique())
        semantic_type = infer_column_semantic_type(col, series)
        
        # Convert sample values cleanly (handles Timestamps, NaT, NaN)
        raw_samples = series.dropna().head(5).tolist()
        clean_samples = []
        for x in raw_samples:
            if isinstance(x, (pd.Timestamp, np.datetime64)):
                clean_samples.append(str(x))
            elif isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
                clean_samples.append(None)
            else:
                clean_samples.append(x)

        col_summary: Dict[str, Any] = {
            "name": str(col),
            "raw_type": str(series.dtype),
            "semantic_type": semantic_type,
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "unique_count": unique_vals,
            "sample_values": clean_samples
        }
        
        # Numeric stats
        if pd.api.types.is_numeric_dtype(series):
            clean_s = series.dropna()
            if len(clean_s) > 0:
                q25 = float(clean_s.quantile(0.25))
                q75 = float(clean_s.quantile(0.75))
                iqr = q75 - q25
                col_summary["stats"] = {
                    "mean": round(float(clean_s.mean()), 2),
                    "std": round(float(clean_s.std()), 2) if len(clean_s) > 1 else 0.0,
                    "median": round(float(clean_s.median()), 2),
                    "min": round(float(clean_s.min()), 2),
                    "max": round(float(clean_s.max()), 2),
                    "q25": round(q25, 2),
                    "q75": round(q75, 2),
                    "iqr": round(iqr, 2)
                }
        elif semantic_type in ['category', 'text']:
            top_vals = series.value_counts().head(5).to_dict()
            col_summary["top_categories"] = {str(k): int(v) for k, v in top_vals.items()}

        columns_profile.append(col_summary)
        
    total_cells = max(1, total_rows * total_cols)
    completeness_score = round((1 - (total_missing_cells / total_cells)) * 100, 1)
    uniqueness_score = round((1 - (duplicate_rows / max(1, total_rows))) * 100, 1)
    overall_quality_score = round((completeness_score * 0.7) + (uniqueness_score * 0.3), 1)
    
    # Infer business domain
    cols_joined = " ".join([str(c).lower() for c in df.columns])
    if any(k in cols_joined for k in ['cycle', 'defect', 'temp', 'machine', 'mfg', 'shift', 'yield']):
        domain = "Manufacturing & Production"
    elif any(k in cols_joined for k in ['ship', 'delivery', 'supplier', 'carrier', 'delay', 'transit', 'tracking']):
        domain = "Logistics & Supply Chain"
    elif any(k in cols_joined for k in ['stock', 'inventory', 'sku', 'warehouse', 'reorder', 'shelf']):
        domain = "Inventory & Warehousing"
    elif any(k in cols_joined for k in ['revenue', 'sales', 'profit', 'margin', 'invoice', 'expense']):
        domain = "Sales & Finance"
    elif any(k in cols_joined for k in ['employee', 'salary', 'department', 'tenure', 'headcount']):
        domain = "Human Resources"
    else:
        domain = "General Business Operations"
        
    return {
        "dataset_name": dataset_name,
        "domain": domain,
        "total_rows": total_rows,
        "total_cols": total_cols,
        "duplicate_rows": duplicate_rows,
        "total_missing_cells": total_missing_cells,
        "quality_scores": {
            "overall": overall_quality_score,
            "completeness": completeness_score,
            "uniqueness": uniqueness_score
        },
        "columns": columns_profile
    }
