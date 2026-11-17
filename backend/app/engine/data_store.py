import io
import os
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from app.engine.profiler import profile_dataset

class DataStore:
    """
    In-memory / file-backed session dataset storage.
    Preserves original uploaded raw data and maintains active transformed versions.
    """
    def __init__(self):
        self.raw_dataframes: Dict[str, pd.DataFrame] = {}
        self.active_dataframes: Dict[str, pd.DataFrame] = {}
        self.metadata: Dict[str, Any] = {}
        self.worksheets: Dict[str, List[str]] = {}

    def load_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        dataset_id = f"ds_{len(self.raw_dataframes) + 1}"
        
        def sanitize_df(raw_df: pd.DataFrame) -> pd.DataFrame:
            clean = raw_df.copy()
            # Clean and deduplicate column headers
            seen = {}
            new_cols = []
            for i, c in enumerate(clean.columns):
                c_str = str(c).strip() if (c is not None and str(c).strip() != '') else f"Column_{i+1}"
                if c_str in seen:
                    seen[c_str] += 1
                    new_cols.append(f"{c_str}_{seen[c_str]}")
                else:
                    seen[c_str] = 0
                    new_cols.append(c_str)
            clean.columns = new_cols
            return clean

        sheet_names = []
        if ext in ['xlsx', 'xls', 'xlsm']:
            try:
                engine = 'openpyxl' if ext in ['xlsx', 'xlsm'] else 'xlrd'
                excel_file = pd.ExcelFile(io.BytesIO(file_bytes), engine=engine)
            except Exception:
                excel_file = pd.ExcelFile(io.BytesIO(file_bytes))

            sheet_names = excel_file.sheet_names
            if not sheet_names:
                raise ValueError("The uploaded Excel workbook contains no worksheets.")

            primary_sheet = sheet_names[0]
            df = sanitize_df(excel_file.parse(primary_sheet))
            self.worksheets[dataset_id] = sheet_names
            # Cache all sheets
            for s in sheet_names:
                sheet_df = sanitize_df(excel_file.parse(s))
                self.raw_dataframes[f"{dataset_id}_{s}"] = sheet_df.copy()
                self.active_dataframes[f"{dataset_id}_{s}"] = sheet_df.copy()
        elif ext == 'csv':
            try:
                raw_csv = pd.read_csv(io.BytesIO(file_bytes))
            except UnicodeDecodeError:
                raw_csv = pd.read_csv(io.BytesIO(file_bytes), encoding='latin1')
            df = sanitize_df(raw_csv)
            sheet_names = ["Default"]
            self.worksheets[dataset_id] = sheet_names
            self.raw_dataframes[f"{dataset_id}_Default"] = df.copy()
            self.active_dataframes[f"{dataset_id}_Default"] = df.copy()
        else:
            raise ValueError(f"Unsupported file format: .{ext}. Supported formats are .xlsx, .xls, .xlsm, .csv")

        active_key = f"{dataset_id}_{sheet_names[0]}"
        self.raw_dataframes[dataset_id] = df.copy()
        self.active_dataframes[dataset_id] = df.copy()

        profile = profile_dataset(df, dataset_name=filename)
        
        self.metadata[dataset_id] = {
            "dataset_id": dataset_id,
            "filename": filename,
            "sheets": sheet_names,
            "active_sheet": sheet_names[0],
            "profile": profile
        }
        return self.metadata[dataset_id]

    def switch_sheet(self, dataset_id: str, sheet_name: str) -> Dict[str, Any]:
        key = f"{dataset_id}_{sheet_name}"
        if key not in self.raw_dataframes:
            raise KeyError(f"Sheet '{sheet_name}' not found for dataset {dataset_id}")
            
        df = self.raw_dataframes[key]
        self.raw_dataframes[dataset_id] = df.copy()
        self.active_dataframes[dataset_id] = df.copy()
        
        profile = profile_dataset(df, dataset_name=f"{self.metadata[dataset_id]['filename']} [{sheet_name}]")
        self.metadata[dataset_id]["active_sheet"] = sheet_name
        self.metadata[dataset_id]["profile"] = profile
        return self.metadata[dataset_id]

    def get_preview(self, dataset_id: str, page: int = 1, page_size: int = 25, columns: Optional[List[str]] = None) -> Dict[str, Any]:
        if dataset_id not in self.active_dataframes:
            raise KeyError(f"Dataset {dataset_id} not found")
            
        df = self.active_dataframes[dataset_id]
        if columns:
            valid_cols = [c for c in columns if c in df.columns]
            if valid_cols:
                df = df[valid_cols]
                
        total_rows = len(df)
        total_pages = max(1, (total_rows + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_rows)
        
        # Replace NaN / Inf / NaT with None for clean JSON serialization
        slice_df = df.iloc[start_idx:end_idx].copy().astype(object)
        slice_df = slice_df.replace([np.inf, -np.inf], None)
        slice_df = slice_df.where(pd.notnull(slice_df), None)
        records = slice_df.to_dict(orient="records")
        
        return {
            "dataset_id": dataset_id,
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "total_pages": total_pages,
            "columns": [str(c) for c in df.columns],
            "records": records
        }

# Global singleton
store = DataStore()
