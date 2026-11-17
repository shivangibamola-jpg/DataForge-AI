import io
import re
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
PHONE_REGEX = re.compile(r'^\+?[0-9\s\-\(\)\.]{7,20}$')

def singularize_entity_name(name: str) -> str:
    """Converts plural sheet name into a clean singular entity name."""
    clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', name).strip().title()
    if clean.endswith('ies'):
        return clean[:-3] + 'y'
    elif clean.endswith('ses') or clean.endswith('xes') or clean.endswith('ches') or clean.endswith('shes'):
        return clean[:-2]
    elif clean.endswith('s') and not clean.endswith('ss'):
        return clean[:-1]
    return clean

def detect_header_row(raw_df: pd.DataFrame) -> Tuple[int, pd.DataFrame]:
    """
    Intelligently find the header row if the workbook has title/banner rows at the top.
    Evaluates the first 5 rows for highest number of unique string values.
    """
    if len(raw_df) == 0:
        return 0, raw_df
        
    best_row_idx = 0
    max_score = -1

    # Check top min(5, len(raw_df)) rows
    check_limit = min(5, len(raw_df))
    for r in range(check_limit):
        row_vals = raw_df.iloc[r].dropna().tolist()
        if not row_vals:
            continue
        # Score based on count of string elements and uniqueness
        str_count = sum(1 for v in row_vals if isinstance(v, str) and len(str(v).strip()) > 0)
        unique_count = len(set(str(v).strip() for v in row_vals if pd.notna(v)))
        
        # Heuristic: headers typically have multiple unique strings without heavy numbers
        score = (str_count * 2) + unique_count
        if score > max_score and str_count >= 2:
            max_score = score
            best_row_idx = r

    if best_row_idx > 0:
        # Use row best_row_idx as header
        new_header = [str(val).strip() if pd.notna(val) else f"Column_{i+1}" for i, val in enumerate(raw_df.iloc[best_row_idx])]
        df = raw_df.iloc[best_row_idx + 1:].copy()
        df.columns = new_header
        df.reset_index(drop=True, inplace=True)
        return best_row_idx, df
    else:
        # Check if row 0 was already parsed as header by pandas
        return 0, raw_df

def infer_field_metadata(col_name: str, series: pd.Series, total_rows: int) -> Dict[str, Any]:
    """
    Deep inference of field data type, semantic role, constraints, and validation rules.
    """
    col_clean = str(col_name).strip()
    col_lower = col_clean.lower()
    clean_series = series.dropna()
    non_null_count = len(clean_series)
    missing_count = int(series.isna().sum())
    unique_count = int(clean_series.nunique())
    
    # Required check: if 0 missing values and rows > 0
    is_required = missing_count == 0 and total_rows > 0

    # Primary key candidate check
    is_pk_candidate = False
    if total_rows > 0 and unique_count == total_rows and missing_count == 0:
        if any(col_lower.endswith(sfx) for sfx in ['_id', 'id', '_code', 'code', 'num', 'key', '_name', 'name', '_key']) or col_lower in ['id', 'uuid', 'code', 'ref', 'name', 'key']:
            is_pk_candidate = True

    # 1. Email check
    if non_null_count > 0 and 'email' in col_lower:
        sample_str = clean_series.astype(str).head(10)
        if any(EMAIL_REGEX.match(s.strip()) for s in sample_str):
            return {
                "name": col_clean,
                "label": col_clean.replace('_', ' ').title(),
                "type": "email",
                "required": is_required,
                "is_primary_key": False,
                "missing_count": missing_count,
                "unique_count": unique_count,
                "validation": {"pattern": r"^[^@]+@[^@]+\.[^@]+$"},
                "sample_values": clean_series.head(5).tolist()
            }

    # 2. Phone check
    if non_null_count > 0 and any(p in col_lower for p in ['phone', 'mobile', 'cell', 'tel']):
        return {
            "name": col_clean,
            "label": col_clean.replace('_', ' ').title(),
            "type": "phone",
            "required": is_required,
            "is_primary_key": False,
            "missing_count": missing_count,
            "unique_count": unique_count,
            "validation": {},
            "sample_values": clean_series.head(5).tolist()
        }

    # 3. Boolean check
    if non_null_count > 0 and unique_count <= 2:
        vals_set = set(clean_series.astype(str).str.strip().str.lower().unique())
        if vals_set.issubset({'true', 'false', '1', '0', 'yes', 'no', 't', 'f', 'y', 'n'}):
            return {
                "name": col_clean,
                "label": col_clean.replace('_', ' ').title(),
                "type": "boolean",
                "required": is_required,
                "is_primary_key": False,
                "missing_count": missing_count,
                "unique_count": unique_count,
                "validation": {},
                "sample_values": clean_series.head(5).tolist()
            }

    # 4. Date / Datetime check
    is_date = False
    if 'date' in col_lower or 'time' in col_lower or 'created' in col_lower or 'updated' in col_lower or 'deadline' in col_lower:
        if pd.api.types.is_datetime64_any_dtype(series):
            is_date = True
        elif non_null_count > 0:
            sample = clean_series.head(10).astype(str)
            try:
                pd.to_datetime(sample)
                is_date = True
            except Exception:
                pass
    if is_date:
        return {
            "name": col_clean,
            "label": col_clean.replace('_', ' ').title(),
            "type": "date",
            "required": is_required,
            "is_primary_key": False,
            "missing_count": missing_count,
            "unique_count": unique_count,
            "validation": {},
            "sample_values": clean_series.head(5).astype(str).tolist()
        }

    # 5. Currency check
    if any(k in col_lower for k in ['usd', 'eur', 'inr', 'gbp', 'cost', 'price', 'revenue', 'salary', 'budget', 'amount', 'fee', 'total_cost']):
        if pd.api.types.is_numeric_dtype(series) or non_null_count > 0:
            min_val = float(clean_series.min()) if pd.api.types.is_numeric_dtype(series) and non_null_count > 0 else 0.0
            max_val = float(clean_series.max()) if pd.api.types.is_numeric_dtype(series) and non_null_count > 0 else 100000.0
            return {
                "name": col_clean,
                "label": col_clean.replace('_', ' ').title(),
                "type": "currency",
                "required": is_required,
                "is_primary_key": False,
                "missing_count": missing_count,
                "unique_count": unique_count,
                "validation": {"min": min_val, "max": max_val * 2},
                "sample_values": clean_series.head(5).tolist()
            }

    # 6. Percentage check
    if any(k in col_lower for k in ['pct', 'percent', 'rate', 'ratio', 'margin_pct']):
        if pd.api.types.is_numeric_dtype(series):
            return {
                "name": col_clean,
                "label": col_clean.replace('_', ' ').title(),
                "type": "percentage",
                "required": is_required,
                "is_primary_key": False,
                "missing_count": missing_count,
                "unique_count": unique_count,
                "validation": {"min": 0, "max": 100},
                "sample_values": clean_series.head(5).tolist()
            }

    # 7. Numeric check (Integer vs Float)
    if pd.api.types.is_numeric_dtype(series):
        is_integer = False
        if pd.api.types.is_integer_dtype(series):
            is_integer = True
        elif non_null_count > 0:
            # Check if all floats are whole numbers
            try:
                if (clean_series % 1 == 0).all():
                    is_integer = True
            except Exception:
                pass

        min_val = float(clean_series.min()) if non_null_count > 0 else 0
        max_val = float(clean_series.max()) if non_null_count > 0 else 1000

        # If it's a numeric ID code or has id in name
        if is_pk_candidate or ('id' in col_lower and is_integer and unique_count == total_rows):
            return {
                "name": col_clean,
                "label": col_clean.replace('_', ' ').title(),
                "type": "id",
                "required": True,
                "is_primary_key": True,
                "missing_count": missing_count,
                "unique_count": unique_count,
                "validation": {},
                "sample_values": clean_series.head(5).tolist()
            }

        return {
            "name": col_clean,
            "label": col_clean.replace('_', ' ').title(),
            "type": "integer" if is_integer else "number",
            "required": is_required,
            "is_primary_key": False,
            "missing_count": missing_count,
            "unique_count": unique_count,
            "validation": {"min": min_val, "max": max_val * 1.5},
            "sample_values": clean_series.head(5).tolist()
        }

    # 8. Categorical / Select Dropdown check
    # If string with limited unique choices (<= 25 or <= 20% cardinality) and NOT a unique key
    if not is_pk_candidate and non_null_count > 0 and (unique_count < total_rows) and (unique_count <= 25 or (total_rows > 30 and (unique_count / total_rows) <= 0.20)):
        options = [str(x).strip() for x in clean_series.unique() if pd.notna(x) and str(x).strip() != ''][:30]
        return {
            "name": col_clean,
            "label": col_clean.replace('_', ' ').title(),
            "type": "category",
            "required": is_required,
            "is_primary_key": False,
            "options": options,
            "missing_count": missing_count,
            "unique_count": unique_count,
            "validation": {},
            "sample_values": clean_series.head(5).tolist()
        }

    # 9. ID string check
    if is_pk_candidate or (any(col_lower.endswith(sfx) for sfx in ['_id', 'id', '_code', 'code']) and unique_count == total_rows):
        return {
            "name": col_clean,
            "label": col_clean.replace('_', ' ').title(),
            "type": "id",
            "required": True,
            "is_primary_key": True,
            "missing_count": missing_count,
            "unique_count": unique_count,
            "validation": {},
            "sample_values": clean_series.head(5).tolist()
        }

    # 10. Default Text / Long Text
    avg_len = clean_series.astype(str).str.len().mean() if non_null_count > 0 else 10
    field_type = "textarea" if avg_len > 60 else "text"

    return {
        "name": col_clean,
        "label": col_clean.replace('_', ' ').title(),
        "type": field_type,
        "required": is_required,
        "is_primary_key": False,
        "missing_count": missing_count,
        "unique_count": unique_count,
        "validation": {},
        "sample_values": clean_series.head(5).tolist()
    }

def detect_relationships(sheets_metadata: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detects foreign keys and cross-sheet relationships.
    E.g., Sheet 'Shipments' having 'Supplier_ID' matches Sheet 'Suppliers' having 'Supplier_ID' or 'ID'.
    """
    relationships = []
    sheet_names = list(sheets_metadata.keys())

    for s_name in sheet_names:
        fields = sheets_metadata[s_name]["fields"]
        s_clean = s_name.lower().replace(' ', '_')
        
        for f in fields:
            f_name = f["name"].lower()
            if f.get("is_primary_key"):
                continue
                
            # Check if this field references another sheet
            for target_sheet in sheet_names:
                if target_sheet == s_name:
                    continue
                t_clean = target_sheet.lower().replace(' ', '_')
                t_sing = singularize_entity_name(target_sheet).lower().replace(' ', '_')
                
                # Matching patterns: supplier_id matches Suppliers.id or Suppliers.supplier_id
                target_fields = {tf["name"].lower(): tf["name"] for tf in sheets_metadata[target_sheet]["fields"]}
                target_pk = sheets_metadata[target_sheet]["primary_key"]
                target_pk_lower = target_pk.lower()
                
                matched_target_col = None
                if f_name in target_fields and target_pk_lower == f_name:
                    matched_target_col = target_fields[f_name]
                elif f_name in [f"{t_sing}_id", f"{t_clean}_id", t_sing, t_clean] or t_sing.startswith(f_name) or f_name.startswith(t_sing):
                    # Look for target PK
                    matched_target_col = target_pk
                elif target_pk_lower.startswith(f_name) or f_name.startswith(target_pk_lower):
                    matched_target_col = target_pk
                
                if matched_target_col:
                    rel = {
                        "from_sheet": s_name,
                        "from_field": f["name"],
                        "to_sheet": target_sheet,
                        "to_field": matched_target_col,
                        "type": "many_to_one",
                        "description": f"{f['label']} links to {sheets_metadata[target_sheet]['entity_name']} ({matched_target_col})"
                    }
                    relationships.append(rel)
                    f["foreign_key"] = {
                        "target_sheet": target_sheet,
                        "target_field": matched_target_col,
                        "target_entity": sheets_metadata[target_sheet]["entity_name"]
                    }
                    break
                    
    return relationships

def detect_domain_and_purpose(all_cols_joined: str, all_sheets: List[str]) -> Tuple[str, str]:
    """Infers the high-level business domain and purpose description."""
    text = (all_cols_joined + " " + " ".join(all_sheets)).lower()
    
    if any(k in text for k in ['employee', 'salary', 'department', 'hire_date', 'job_title', 'staff', 'hr', 'payroll']):
        return "Human Resources & Workforce", "Workforce operations, personnel profiles, departmental allocations, and compensation tracking."
    elif any(k in text for k in ['sku', 'stock', 'inventory', 'warehouse', 'reorder', 'bin', 'shelf', 'batch_no']):
        return "Inventory & Warehouse Operations", "Real-time stock management, warehouse bin tracking, reorder thresholds, and SKU status."
    elif any(k in text for k in ['cycle_time', 'defect', 'mfg', 'machine', 'temperature', 'shift', 'yield', 'downtime']):
        return "Manufacturing & Industrial Quality", "Assembly operations tracking, defect rate analytics, machine telemetry, and shift production audits."
    elif any(k in text for k in ['supplier', 'vendor', 'carrier', 'shipment', 'tracking', 'transit', 'freight', 'delivery']):
        return "Supply Chain & Multi-Vendor Logistics", "Carrier performance, delivery timelines, vendor SLA adherence, and freight tracking."
    elif any(k in text for k in ['lead', 'deal', 'opportunity', 'customer', 'crm', 'pipeline', 'sales_rep']):
        return "Sales & Customer Relationship (CRM)", "Lead pipeline management, deal progress tracking, client directory, and sales metrics."
    elif any(k in text for k in ['invoice', 'expense', 'revenue', 'tax', 'ledger', 'budget', 'profit', 'billing']):
        return "Finance & Corporate Billing", "Accounts ledger, expense approvals, payment settlement tracking, and fiscal reporting."
    elif any(k in text for k in ['ticket', 'support', 'issue', 'agent', 'priority', 'resolution', 'sla', 'incident']):
        return "Helpdesk & Service Management", "Incident response, customer issue ticketing, SLA resolution times, and team assignment."
    else:
        return "Enterprise Operations & Business Records", "General business records administration, operational KPIs, and multi-entity workflows."

def analyze_workbook(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Parses and deeply analyzes Excel (.xlsx, .xls) or CSV files.
    Produces pre-generation summary report, inferred schema, relationships, and application blueprint.
    """
    ext = filename.split('.')[-1].lower()
    parsed_sheets: Dict[str, pd.DataFrame] = {}
    
    if ext in ['xlsx', 'xls']:
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        for s_name in excel_file.sheet_names:
            raw_sheet = excel_file.parse(s_name)
            _, df = detect_header_row(raw_sheet)
            # Ensure column names are unique and clean strings
            clean_cols = []
            seen_cols = {}
            for i, col in enumerate(df.columns):
                c_str = str(col).strip() if pd.notna(col) and str(col).strip() != '' else f"Column_{i+1}"
                if c_str in seen_cols:
                    seen_cols[c_str] += 1
                    c_str = f"{c_str}_{seen_cols[c_str]}"
                else:
                    seen_cols[c_str] = 0
                clean_cols.append(c_str)
            df.columns = clean_cols
            parsed_sheets[s_name] = df
    elif ext == 'csv':
        raw_csv = pd.read_csv(io.BytesIO(file_bytes))
        _, df = detect_header_row(raw_csv)
        clean_cols = []
        seen_cols = {}
        for i, col in enumerate(df.columns):
            c_str = str(col).strip() if pd.notna(col) and str(col).strip() != '' else f"Column_{i+1}"
            if c_str in seen_cols:
                seen_cols[c_str] += 1
                c_str = f"{c_str}_{seen_cols[c_str]}"
            else:
                seen_cols[c_str] = 0
            clean_cols.append(c_str)
        df.columns = clean_cols
        parsed_sheets["Default"] = df
    else:
        raise ValueError(f"Unsupported file format: .{ext}. Supported formats are .xlsx, .xls, and .csv")

    sheets_metadata: Dict[str, Dict[str, Any]] = {}
    total_records_all = 0
    total_columns_all = 0
    total_missing_cells_all = 0
    all_col_names = []

    for s_name, df in parsed_sheets.items():
        total_rows = len(df)
        total_cols = len(df.columns)
        total_records_all += total_rows
        total_columns_all += total_cols
        duplicate_rows = int(df.duplicated().sum())
        all_col_names.extend(df.columns)

        entity_name = singularize_entity_name(s_name if s_name != "Default" else filename.split('.')[0])
        
        # Analyze each field
        fields: List[Dict[str, Any]] = []
        pk_found = None
        missing_cells_sheet = 0

        for col in df.columns:
            series = df[col]
            missing_cells_sheet += int(series.isna().sum())
            f_meta = infer_field_metadata(col, series, total_rows)
            if f_meta.get("is_primary_key") and not pk_found:
                pk_found = col
            fields.append(f_meta)

        total_missing_cells_all += missing_cells_sheet

        # If no natural PK found, designate an auto-generated ID
        if not pk_found:
            pk_found = "id"
            # Flag in fields or prepare auto ID
            has_id_col = any(f["name"].lower() == "id" for f in fields)
            if not has_id_col:
                fields.insert(0, {
                    "name": "id",
                    "label": f"{entity_name} ID",
                    "type": "id",
                    "required": True,
                    "is_primary_key": True,
                    "is_autogenerated": True,
                    "missing_count": 0,
                    "unique_count": total_rows,
                    "validation": {},
                    "sample_values": ["Auto-generated"]
                })
            else:
                for f in fields:
                    if f["name"].lower() == "id":
                        f["is_primary_key"] = True
                        break

        # Ensure ONLY the designated pk_found has is_primary_key = True
        for f in fields:
            f["is_primary_key"] = (f["name"] == pk_found)

        # Calculate numerical metrics
        numerical_summaries = {}
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                cs = df[col].dropna()
                if len(cs) > 0:
                    numerical_summaries[col] = {
                        "sum": round(float(cs.sum()), 2),
                        "mean": round(float(cs.mean()), 2),
                        "min": round(float(cs.min()), 2),
                        "max": round(float(cs.max()), 2),
                        "median": round(float(cs.median()), 2)
                    }

        sheets_metadata[s_name] = {
            "sheet_name": s_name,
            "entity_name": entity_name,
            "display_name": entity_name,
            "total_rows": total_rows,
            "total_cols": total_cols,
            "duplicate_rows": duplicate_rows,
            "missing_cells": missing_cells_sheet,
            "primary_key": pk_found,
            "fields": fields,
            "numerical_summaries": numerical_summaries
        }

    # Detect cross-worksheet relationships
    relationships = detect_relationships(sheets_metadata)

    # Business domain & purpose
    domain, purpose = detect_domain_and_purpose(" ".join(all_col_names), list(parsed_sheets.keys()))

    # Calculate overall health scores
    total_cells = max(1, total_records_all * total_columns_all)
    completeness = round(max(0.0, (1 - (total_missing_cells_all / total_cells)) * 100), 1)
    quality_score = round(completeness * 0.95, 1)

    # Suggest clean application name
    app_name = filename.rsplit('.', 1)[0].replace('_', ' ').replace('-', ' ').title()
    if len(parsed_sheets) > 1:
        app_name += f" ({domain.split('&')[0].strip()} Suite)"
    else:
        app_name += " Manager"

    # Assemble recommended application blueprint
    blueprint = {
        "app_name": app_name,
        "description": purpose,
        "domain": domain,
        "icon": "Layers",
        "entities": []
    }

    for s_name, sm in sheets_metadata.items():
        # Select best columns for table view
        display_columns = [f["name"] for f in sm["fields"] if not f.get("is_autogenerated")][:6]
        
        # Recommend charts for entity if numerical fields exist
        recommended_charts = []
        num_fields = [f["name"] for f in sm["fields"] if f["type"] in ['number', 'integer', 'currency', 'percentage']]
        cat_fields = [f["name"] for f in sm["fields"] if f["type"] == 'category']
        date_fields = [f["name"] for f in sm["fields"] if f["type"] == 'date']

        if date_fields and num_fields:
            recommended_charts.append({
                "title": f"{num_fields[0].replace('_', ' ').title()} Over Time",
                "type": "line",
                "x_axis": date_fields[0],
                "y_axis": num_fields[0]
            })
        if cat_fields and num_fields:
            recommended_charts.append({
                "title": f"{num_fields[0].replace('_', ' ').title()} by {cat_fields[0].replace('_', ' ').title()}",
                "type": "bar",
                "x_axis": cat_fields[0],
                "y_axis": num_fields[0]
            })
        elif cat_fields:
            recommended_charts.append({
                "title": f"Distribution by {cat_fields[0].replace('_', ' ').title()}",
                "type": "bar",
                "x_axis": cat_fields[0],
                "y_axis": "count"
            })

        entity_spec = {
            "source_sheet": s_name,
            "entity_name": sm["entity_name"],
            "display_name": sm["display_name"],
            "table_name": f"ent_{sm['entity_name'].lower().replace(' ', '_')}",
            "primary_key": sm["primary_key"],
            "total_records": sm["total_rows"],
            "fields": sm["fields"],
            "display_columns": display_columns,
            "numerical_summaries": sm["numerical_summaries"],
            "recommended_charts": recommended_charts
        }
        blueprint["entities"].append(entity_spec)

    return {
        "filename": filename,
        "domain": domain,
        "purpose": purpose,
        "worksheets_count": len(parsed_sheets),
        "total_records": total_records_all,
        "total_columns": total_columns_all,
        "total_missing_cells": total_missing_cells_all,
        "data_quality_score": quality_score,
        "sheets": sheets_metadata,
        "relationships": relationships,
        "blueprint": blueprint
    }
