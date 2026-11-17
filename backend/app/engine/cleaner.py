import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class CleaningRule(BaseModel):
    action: str # drop_duplicates, handle_missing, convert_type, filter_rows, rename_column, calculate_metric
    column: Optional[str] = None
    strategy: Optional[str] = None # e.g. 'mean', 'median', 'mode', 'drop_row', 'forward_fill', 'constant'
    fill_value: Optional[Any] = None
    target_type: Optional[str] = None # 'datetime', 'numeric', 'text'
    filter_condition: Optional[str] = None # e.g. "> 100", "== 'Urgent'"
    new_column_name: Optional[str] = None
    expression: Optional[str] = None # for calculate_metric e.g. "Cycle_Time_Min * 60"

def apply_transformation_pipeline(df: pd.DataFrame, rules: List[CleaningRule]) -> pd.DataFrame:
    """
    Applies non-code human-readable data transformations deterministically.
    Always operates on a copy, maintaining data safety.
    """
    result_df = df.copy()

    for rule in rules:
        if rule.action == "drop_duplicates":
            if rule.column and rule.column in result_df.columns:
                result_df = result_df.drop_duplicates(subset=[rule.column])
            else:
                result_df = result_df.drop_duplicates()

        elif rule.action == "handle_missing":
            col = rule.column
            if col and col in result_df.columns:
                strat = rule.strategy
                if strat == "drop_row":
                    result_df = result_df.dropna(subset=[col])
                elif strat == "mean" and pd.api.types.is_numeric_dtype(result_df[col]):
                    result_df[col] = result_df[col].fillna(result_df[col].mean())
                elif strat == "median" and pd.api.types.is_numeric_dtype(result_df[col]):
                    result_df[col] = result_df[col].fillna(result_df[col].median())
                elif strat == "mode":
                    mode_val = result_df[col].mode()
                    if len(mode_val) > 0:
                        result_df[col] = result_df[col].fillna(mode_val[0])
                elif strat == "forward_fill":
                    result_df[col] = result_df[col].ffill()
                elif strat == "constant" and rule.fill_value is not None:
                    result_df[col] = result_df[col].fillna(rule.fill_value)

        elif rule.action == "convert_type":
            col = rule.column
            if col and col in result_df.columns:
                if rule.target_type == "numeric":
                    result_df[col] = pd.to_numeric(result_df[col], errors="coerce")
                elif rule.target_type == "datetime":
                    result_df[col] = pd.to_datetime(result_df[col], errors="coerce")
                elif rule.target_type == "text":
                    result_df[col] = result_df[col].astype(str)

        elif rule.action == "rename_column":
            if rule.column and rule.new_column_name and rule.column in result_df.columns:
                result_df = result_df.rename(columns={rule.column: rule.new_column_name})

        elif rule.action == "calculate_metric":
            # Safe evaluation of basic operations between numeric columns
            if rule.new_column_name and rule.expression:
                try:
                    # Evaluate expression safely using pandas eval
                    result_df[rule.new_column_name] = result_df.eval(rule.expression)
                except Exception as e:
                    # If syntax fails, ignore or log
                    pass

    return result_df
