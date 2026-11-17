import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class BusinessRule(BaseModel):
    id: str
    name: str
    column: str # Column to evaluate, e.g., 'Actual_Delivery_Days' or 'Defect_Rate_Pct'
    operator: str # '>', '>=', '<', '<=', '==', '!=', 'between'
    threshold: float
    secondary_threshold: Optional[float] = None # for 'between'
    scope_column: Optional[str] = None # e.g. 'Order_Type' or 'Product_Name'
    scope_value: Optional[str] = None # e.g. 'Standard' or 'Custom'
    severity: str = "High" # "Low", "Medium", "High", "Critical"
    explanation: str

class ApprovedException(BaseModel):
    id: str
    rule_id: str
    record_id: str
    owner: str
    reason: str
    expiry_date: Optional[str] = None
    created_at: str

def evaluate_business_rules(
    df: pd.DataFrame, 
    rules: List[BusinessRule], 
    exceptions: List[ApprovedException]
) -> Dict[str, Any]:
    """
    Evaluates explicit domain rules, cross-references approved exceptions,
    and returns violated records with clear operational context.
    """
    violation_records = []
    
    # Map exceptions by record_id + rule_id
    exception_lookup = {f"{ex.record_id}_{ex.rule_id}": ex for ex in exceptions}

    for rule in rules:
        if rule.column not in df.columns:
            continue
            
        # Target slice
        eval_df = df.copy()
        if rule.scope_column and rule.scope_column in eval_df.columns and rule.scope_value:
            eval_df = eval_df[eval_df[rule.scope_column].astype(str).str.lower() == str(rule.scope_value).lower()]

        # Convert evaluation column to numeric safely
        series = pd.to_numeric(eval_df[rule.column], errors='coerce')
        mask = pd.Series([False] * len(eval_df), index=eval_df.index)

        if rule.operator == '>':
            mask = series > rule.threshold
        elif rule.operator == '>=':
            mask = series >= rule.threshold
        elif rule.operator == '<':
            mask = series < rule.threshold
        elif rule.operator == '<=':
            mask = series <= rule.threshold
        elif rule.operator == '==':
            mask = series == rule.threshold
        elif rule.operator == 'between' and rule.secondary_threshold is not None:
            mask = (series >= rule.threshold) & (series <= rule.secondary_threshold)

        violated_df = eval_df[mask]

        for idx, row in violated_df.iterrows():
            rec_id = str(row.get('Record_ID', row.get('Shipment_ID', row.get('ID', f"Row #{idx + 1}"))))
            ex_key = f"{rec_id}_{rule.id}"
            has_exception = ex_key in exception_lookup
            ex_detail = exception_lookup[ex_key] if has_exception else None

            val = float(row[rule.column])
            
            violation_records.append({
                "violation_id": f"viol_{rule.id}_{rec_id}",
                "rule_id": rule.id,
                "rule_name": rule.name,
                "record_id": rec_id,
                "column": rule.column,
                "observed_value": val,
                "threshold": rule.threshold,
                "operator": rule.operator,
                "scope": f"{rule.scope_column} = {rule.scope_value}" if rule.scope_column else "Global",
                "severity": rule.severity,
                "status": "Approved Exception" if has_exception else "Rule Breach",
                "exception_info": {
                    "owner": ex_detail.owner,
                    "reason": ex_detail.reason,
                    "expiry_date": ex_detail.expiry_date
                } if ex_detail else None,
                "explanation": rule.explanation
            })

    return {
        "total_rules_evaluated": len(rules),
        "total_violations": len(violation_records),
        "active_breaches": len([v for v in violation_records if v["status"] == "Rule Breach"]),
        "approved_exceptions": len([v for v in violation_records if v["status"] == "Approved Exception"]),
        "violations": violation_records
    }
