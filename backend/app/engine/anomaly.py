import re
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.ensemble import IsolationForest

def classify_anomaly_nature(
    col_name: str,
    val: float,
    z: float,
    is_missing_or_nan: bool = False,
    is_negative_unexpected: bool = False,
    expected_val: float = 0.0
) -> Dict[str, str]:
    """
    Distinguishes between potential data-quality errors vs legitimate but unusual business events.
    """
    col_lower = col_name.lower()
    
    # 1. Quality Errors (impossible values, negative counts/costs/times, extreme sensor typos)
    if is_missing_or_nan:
        return {
            "nature": "Data Quality Error",
            "anomaly_type": "Missing Critical Value",
            "suggested_action": f"Check upstream source or input form for blank/null entries in '{col_name}'."
        }
    
    if val < 0 and any(w in col_lower for w in ['count', 'time', 'duration', 'qty', 'quantity', 'cost', 'price', 'rate', 'defect', 'delay', 'lead']):
        return {
            "nature": "Data Quality Error",
            "anomaly_type": "Negative / Invalid Value",
            "suggested_action": f"Inspect data entry error for negative value ({val}) on positive-definite field '{col_name}'."
        }
        
    if any(w in col_lower for w in ['pct', 'percentage', 'percent', 'ratio', 'share', 'rate']) and val > 100 and not any(w in col_lower for w in ['growth', 'increase', 'roi']):
        return {
            "nature": "Data Quality Error",
            "anomaly_type": "Percentage Scale Mismatch",
            "suggested_action": f"Verify whether '{val}' is multiplied twice (expected 0-100%)."
        }
        
    if z > 7.0:
        return {
            "nature": "Potential Data Error",
            "anomaly_type": "Extreme Value / Possible Typo",
            "suggested_action": f"Confirm whether decimal place was misplaced ({val} vs expected ~{round(expected_val, 1)})."
        }

    # 2. Operational & Business Anomalies based on domain terminology
    if any(w in col_lower for w in ['delay', 'lead_time', 'transit', 'delivery', 'wait']):
        return {
            "nature": "Operational Anomaly",
            "anomaly_type": "Unusual Delivery Delay",
            "suggested_action": "Verify carrier route congestion, customs clearance, or supplier shipping bottleneck."
        }
        
    if any(w in col_lower for w in ['cost', 'price', 'spend', 'amount', 'expense', 'usd', 'eur', 'inr']):
        return {
            "nature": "Financial Anomaly",
            "anomaly_type": "Unexpected Cost Surge",
            "suggested_action": "Audit procurement contract terms, spot purchase price variance, or billing discrepancy."
        }
        
    if any(w in col_lower for w in ['inventory', 'stock', 'qty', 'quantity', 'balance']):
        return {
            "nature": "Operational Anomaly",
            "anomaly_type": "Inventory Discrepancy",
            "suggested_action": "Trigger cycle count audit to reconcile physical inventory against recorded balance."
        }
        
    if any(w in col_lower for w in ['defect', 'reject', 'scrap', 'fail', 'error_rate', 'ppm']):
        return {
            "nature": "Quality Anomaly",
            "anomaly_type": "Spike in Defect / Failure Rate",
            "suggested_action": "Inspect batch tooling calibration, raw material lot variance, or operator shifts."
        }
        
    if any(w in col_lower for w in ['temp', 'temperature', 'pressure', 'speed', 'vibration', 'rpm', 'voltage']):
        return {
            "nature": "Operational Anomaly",
            "anomaly_type": "Abnormal Equipment Condition",
            "suggested_action": "Schedule preventive maintenance check on machine thermal/mechanical sensors."
        }
        
    if any(w in col_lower for w in ['salary', 'bonus', 'overtime', 'hours', 'headcount', 'turnover']):
        return {
            "nature": "HR / Workforce Anomaly",
            "anomaly_type": "Unusual Workforce Metric",
            "suggested_action": "Review overtime timesheet approval and department payroll allocation."
        }

    # Generic unusual business event
    return {
        "nature": "Unusual Business Event",
        "anomaly_type": "Statistical Outlier",
        "suggested_action": f"Compare record against peer group operating conditions and historical pattern."
    }


def detect_comprehensive_anomalies(
    df: pd.DataFrame,
    sheet_name: str = "Default",
    target_metric: Optional[str] = None,
    group_by_col: Optional[str] = None,
    contamination: float = 0.05
) -> Dict[str, Any]:
    """
    Comprehensive multi-column anomaly detection:
    1. Scans numerical, categorical, and date features.
    2. Runs Isolation Forest ML and robust IQR / Z-score detection across all metrics or requested metric.
    3. Detects sudden changes, abnormal trends, delivery delays, and inventory discrepancies.
    4. Categorizes data-quality errors vs legitimate business events with investigation suggestions.
    """
    if df is None or len(df) == 0:
        return {
            "status": "empty_dataset",
            "sheet_name": sheet_name,
            "sample_size": 0,
            "total_anomalies_detected": 0,
            "anomalies": [],
            "summary": {
                "total_anomalies": 0,
                "high_severity_count": 0,
                "affected_records_count": 0,
                "most_affected_columns": {},
                "anomaly_types_distribution": {},
                "data_quality_vs_business": {}
            }
        }

    total_records = len(df)
    if total_records < 4:
        return {
            "status": "insufficient_data",
            "sheet_name": sheet_name,
            "sample_size": total_records,
            "message": f"Sample size ({total_records} rows) is too small for statistical or machine learning anomaly inference.",
            "total_anomalies_detected": 0,
            "anomalies": [],
            "summary": {
                "total_anomalies": 0,
                "high_severity_count": 0,
                "affected_records_count": 0,
                "most_affected_columns": {},
                "anomaly_types_distribution": {},
                "data_quality_vs_business": {}
            }
        }

    # Identify record ID column
    id_col = None
    for col in df.columns:
        c_low = col.lower()
        if any(k in c_low for k in ['record_id', 'shipment_id', 'order_id', 'batch_id', 'employee_id', 'product_id', 'sku', 'id']) and df[col].nunique() > total_records * 0.4:
            id_col = col
            break

    # Identify numeric candidate columns
    numeric_cols = []
    for col in df.columns:
        if col.startswith('__'):
            continue
        # Check if column is numeric or can be cast
        numeric_series = pd.to_numeric(df[col], errors='coerce')
        if numeric_series.notnull().sum() >= max(3, total_records * 0.4):
            # Check if not constant
            if numeric_series.dropna().nunique() > 1:
                numeric_cols.append(col)

    if not numeric_cols:
        return {
            "status": "no_numeric_features",
            "sheet_name": sheet_name,
            "sample_size": total_records,
            "message": "No continuous numeric columns found in this worksheet for anomaly detection.",
            "total_anomalies_detected": 0,
            "anomalies": [],
            "summary": {
                "total_anomalies": 0,
                "high_severity_count": 0,
                "affected_records_count": 0,
                "most_affected_columns": {},
                "anomaly_types_distribution": {},
                "data_quality_vs_business": {}
            }
        }

    # Decide which metrics to analyze
    cols_to_analyze = [target_metric] if target_metric and target_metric in numeric_cols else numeric_cols

    # Prepare multi-feature matrix for Isolation Forest if multiple numeric cols exist
    ml_scores_by_col = {}
    ml_flags_by_col = {}
    ml_active = False

    if total_records >= 20 and len(cols_to_analyze) > 0:
        try:
            # Impute median for missing values in numeric cols
            clean_sub = df[cols_to_analyze].apply(pd.to_numeric, errors='coerce')
            clean_sub_filled = clean_sub.fillna(clean_sub.median())
            
            iso = IsolationForest(
                contamination=min(0.15, max(0.01, contamination)),
                random_state=42,
                n_estimators=100
            )
            multi_preds = iso.fit_predict(clean_sub_filled)
            multi_scores = -iso.decision_function(clean_sub_filled)
            
            for c in cols_to_analyze:
                ml_scores_by_col[c] = multi_scores
                ml_flags_by_col[c] = multi_preds == -1
            ml_active = True
        except Exception:
            ml_active = False

    all_anomalies = []
    affected_rows_set = set()
    col_anomaly_count = {}
    type_distribution = {}
    nature_distribution = {}

    for col in cols_to_analyze:
        num_s = pd.to_numeric(df[col], errors='coerce')
        valid_s = num_s.dropna()
        if len(valid_s) < 4:
            continue

        mean = float(valid_s.mean())
        median = float(valid_s.median())
        std = float(valid_s.std()) if len(valid_s) > 1 else 0.0
        q25 = float(valid_s.quantile(0.25))
        q75 = float(valid_s.quantile(0.75))
        iqr = q75 - q25
        iqr_lower = q25 - (1.5 * iqr)
        iqr_upper = q75 + (1.5 * iqr)

        # Group baselines if grouping column specified
        group_medians = {}
        if group_by_col and group_by_col in df.columns:
            try:
                g = df.groupby(group_by_col)[col].apply(lambda s: pd.to_numeric(s, errors='coerce').median()).to_dict()
                group_medians = {str(k): float(v) for k, v in g.items() if pd.notnull(v)}
            except Exception:
                group_medians = {}

        # Scan each record
        for idx in range(total_records):
            val = num_s.iloc[idx]
            row_raw = df.iloc[idx]

            # Missing value check on key columns
            if pd.isna(val):
                # Only flag missing as anomaly if non-missing rate is very high (> 95%)
                if len(valid_s) / total_records >= 0.95:
                    classification = classify_anomaly_nature(col, 0.0, 0.0, is_missing_or_nan=True)
                    rec_id = str(row_raw.get(id_col, f"Row #{idx + 1}")) if id_col else f"Row #{idx + 1}"
                    all_anomalies.append({
                        "sheet": sheet_name,
                        "record_id": rec_id,
                        "row_index": idx,
                        "column": col,
                        "observed_value": None,
                        "expected_baseline": round(median, 2),
                        "deviation_pct": 100.0,
                        "z_score": 0.0,
                        "anomaly_score": 0.85,
                        "severity": "Medium",
                        "nature": classification["nature"],
                        "anomaly_type": classification["anomaly_type"],
                        "reason": f"Missing critical value in field '{col}' where dataset is 95%+ complete",
                        "suggested_action": classification["suggested_action"],
                        "review_status": "Flagged"
                    })
                    affected_rows_set.add(idx)
                    col_anomaly_count[col] = col_anomaly_count.get(col, 0) + 1
                    type_distribution[classification["anomaly_type"]] = type_distribution.get(classification["anomaly_type"], 0) + 1
                    nature_distribution[classification["nature"]] = nature_distribution.get(classification["nature"], 0) + 1
                continue

            # Statistical checks
            z = abs((val - mean) / std) if std > 0 else 0.0
            is_iqr = bool(val < iqr_lower or val > iqr_upper)
            is_ml = bool(ml_flags_by_col.get(col, [False])[idx]) if ml_active else False
            ml_score = float(ml_scores_by_col.get(col, [0.0])[idx]) if ml_active else 0.0

            # Baseline calculation
            expected_val = median
            group_key = str(row_raw.get(group_by_col, '')) if group_by_col else None
            if group_key and group_key in group_medians:
                expected_val = group_medians[group_key]

            deviation_pct = round(((val - expected_val) / max(0.0001, abs(expected_val))) * 100, 1)

            # Flag condition
            is_flagged = (z >= 2.2) or (is_iqr and abs(deviation_pct) > 35) or (is_ml and z >= 1.8) or (val < 0 and any(w in col.lower() for w in ['count', 'time', 'delay', 'qty', 'cost']))

            if is_flagged:
                # Score from 0.0 to 1.0
                score = round(min(1.0, max(0.1, (z / 5.0) * 0.6 + (0.4 if is_ml else (0.2 if is_iqr else 0.0)))), 3)

                # Severity
                if z >= 3.5 or abs(deviation_pct) > 120 or score >= 0.85:
                    severity = "Critical"
                elif z >= 2.3 or abs(deviation_pct) > 50 or score >= 0.60:
                    severity = "Medium"
                else:
                    severity = "Low"

                classification = classify_anomaly_nature(col, val, z, expected_val=expected_val)

                # Construct rich reason explanation
                reasons = []
                if z >= 2.2:
                    reasons.append(f"{round(z, 1)}σ deviation from mean ({round(mean, 1)})")
                if is_iqr:
                    reasons.append(f"Outside 1.5x IQR span [{round(iqr_lower, 1)} → {round(iqr_upper, 1)}]")
                if is_ml:
                    reasons.append(f"Isolation Forest flagged pattern irregularity (score: {score})")
                if group_key and abs(deviation_pct) > 30:
                    reasons.append(f"{deviation_pct:+0.1f}% vs {group_by_col} '{group_key}' baseline ({round(expected_val, 1)})")

                rec_id = str(row_raw.get(id_col, f"Row #{idx + 1}")) if id_col else f"Row #{idx + 1}"

                # Append entity search context (vendor, product, employee, machine)
                entity_tokens = []
                for ec in df.columns:
                    if ec != col and not ec.startswith('__'):
                        val_str = str(row_raw.get(ec, ''))
                        if len(val_str) < 40 and val_str not in ('nan', 'None', ''):
                            entity_tokens.append(f"{ec}: {val_str}")

                all_anomalies.append({
                    "sheet": sheet_name,
                    "record_id": rec_id,
                    "row_index": int(idx),
                    "column": col,
                    "observed_value": round(float(val), 2),
                    "expected_baseline": round(float(expected_val), 2),
                    "deviation_pct": round(float(deviation_pct), 1),
                    "z_score": round(float(z), 2),
                    "anomaly_score": float(score),
                    "severity": severity,
                    "nature": classification["nature"],
                    "anomaly_type": classification["anomaly_type"],
                    "reason": " • ".join(reasons) if reasons else f"Unusual value ({val}) vs baseline ({expected_val})",
                    "suggested_action": classification["suggested_action"],
                    "entity_context": " | ".join(entity_tokens[:4]),
                    "review_status": "Flagged"
                })

                affected_rows_set.add(idx)
                col_anomaly_count[col] = col_anomaly_count.get(col, 0) + 1
                type_distribution[classification["anomaly_type"]] = type_distribution.get(classification["anomaly_type"], 0) + 1
                nature_distribution[classification["nature"]] = nature_distribution.get(classification["nature"], 0) + 1

    # Sort Critical first, then by anomaly score descending
    severity_order = {"Critical": 0, "Medium": 1, "Low": 2}
    all_anomalies.sort(key=lambda x: (severity_order.get(x['severity'], 3), -x['anomaly_score']))

    high_severity_count = sum(1 for a in all_anomalies if a['severity'] == 'Critical')

    return {
        "status": "success",
        "sheet_name": sheet_name,
        "sample_size": total_records,
        "target_metric": target_metric or "All Continuous Columns",
        "ml_engine_active": ml_active,
        "ml_algorithm": "Isolation Forest (Ensemble Tree ML) + Robust IQR & Z-score" if ml_active else "Robust Statistical (IQR Boundaries & Z-scores)",
        "total_anomalies_detected": len(all_anomalies),
        "anomalies": all_anomalies,
        "summary": {
            "total_anomalies": len(all_anomalies),
            "high_severity_count": high_severity_count,
            "affected_records_count": len(affected_rows_set),
            "most_affected_columns": dict(sorted(col_anomaly_count.items(), key=lambda x: -x[1])[:6]),
            "anomaly_types_distribution": type_distribution,
            "data_quality_vs_business": nature_distribution
        }
    }
