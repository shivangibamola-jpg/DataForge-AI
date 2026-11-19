import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel

# Load environment variables safely from project directories only
project_root = Path(__file__).resolve().parent.parent.parent
backend_dir = Path(__file__).resolve().parent.parent
for env_file in [project_root / ".env", backend_dir / ".env"]:
    if env_file.is_file():
        load_dotenv(dotenv_path=env_file)

from app.engine.data_store import store
from app.engine.cleaner import CleaningRule, apply_transformation_pipeline
from app.engine.anomaly import detect_comprehensive_anomalies
from app.engine.business_rules import BusinessRule, ApprovedException, evaluate_business_rules
from app.engine.visualizer import recommend_visualizations
from app.engine.predictor import generate_predictions_and_insights
from app.engine.search_engine import execute_universal_search, compute_column_stats
from app.routers.studio_router import router as studio_router

app = FastAPI(
    title="DataForge AI Universal Platform",
    description="Universal Data Intelligence, Anomaly Detection & AI Studio Platform",
    version="1.0.0"
)

# Configure CORS dynamically from environment or default to development origins
cors_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include AI-Powered App Generator Studio router
app.include_router(studio_router)

# In-memory storage for rules and exceptions per dataset
dataset_rules: dict = {}
dataset_exceptions: dict = {}

@app.get("/api/health")
def health_check():
    return {"status": "online", "platform": "DataForge AI v1.0"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Accepts CSV or multi-worksheet Excel files, profiles them, and caches them."""
    try:
        content = await file.read()
        res = store.load_file(content, file.filename)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/load_sample")
def load_sample(sample_name: str = Query("manufacturing")):
    """Quickly loads built-in realistic business samples."""
    sample_filenames = {
        "manufacturing": "manufacturing_operations.csv",
        "logistics": "supply_chain_multi_sheet.xlsx"
    }
    filename = sample_filenames.get(sample_name)
    if not filename:
        raise HTTPException(status_code=404, detail=f"Unknown sample name '{sample_name}'")

    candidate_paths = [
        project_root / "sample_data" / filename,
        backend_dir / "sample_data" / filename,
        Path(__file__).resolve().parent / "sample_data" / filename,
    ]

    path = next((p for p in candidate_paths if p.is_file()), None)
    if not path:
        raise HTTPException(status_code=404, detail=f"Sample dataset not found at any candidate location")

    with open(path, "rb") as f:
        content = f.read()
    res = store.load_file(content, filename)
    return {"success": True, "data": res}

@app.post("/api/switch_sheet")
def switch_sheet(dataset_id: str = Form(...), sheet_name: str = Form(...)):
    try:
        res = store.switch_sheet(dataset_id, sheet_name)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/preview")
def get_preview(
    dataset_id: str,
    page: int = 1,
    page_size: int = 25,
    columns: Optional[str] = None
):
    try:
        col_list = [c.strip() for c in columns.split(",")] if columns else None
        res = store.get_preview(dataset_id, page, page_size, col_list)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

class TransformPayload(BaseModel):
    dataset_id: str
    rules: List[CleaningRule]

@app.post("/api/transform")
def transform_data(payload: TransformPayload):
    """Applies non-code cleaning pipeline and updates active dataset."""
    if payload.dataset_id not in store.raw_dataframes:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    raw_df = store.raw_dataframes[payload.dataset_id]
    cleaned_df = apply_transformation_pipeline(raw_df, payload.rules)
    store.active_dataframes[payload.dataset_id] = cleaned_df
    
    # Re-profile active dataset
    from app.engine.profiler import profile_dataset
    updated_profile = profile_dataset(cleaned_df, dataset_name=store.metadata[payload.dataset_id]["filename"])
    store.metadata[payload.dataset_id]["profile"] = updated_profile

    return {
        "success": True,
        "profile": updated_profile,
        "rows_before": len(raw_df),
        "rows_after": len(cleaned_df)
    }

@app.post("/api/revert_transform")
def revert_transform(dataset_id: str = Form(...)):
    """Reverts to the pristine original uploaded dataset."""
    if dataset_id not in store.raw_dataframes:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    store.active_dataframes[dataset_id] = store.raw_dataframes[dataset_id].copy()
    from app.engine.profiler import profile_dataset
    profile = profile_dataset(store.active_dataframes[dataset_id], dataset_name=store.metadata[dataset_id]["filename"])
    store.metadata[dataset_id]["profile"] = profile
    return {"success": True, "profile": profile}

@app.get("/api/anomalies")
def get_anomalies(
    dataset_id: str,
    metric: Optional[str] = None,
    sheet: Optional[str] = None,
    group_by: Optional[str] = None,
    contamination: float = 0.05
):
    """
    Runs adaptive statistical + Isolation Forest ML anomaly detection across worksheets,
    multi-column metrics, and operational domains.
    """
    if dataset_id not in store.raw_dataframes and dataset_id not in store.active_dataframes:
        raise HTTPException(status_code=404, detail="Dataset not found")

    available_sheets = store.worksheets.get(dataset_id, ["Default"])
    sheets_to_process = [sheet] if sheet and sheet != "all" else available_sheets

    all_anomalies = []
    combined_summary = {
        "total_anomalies": 0,
        "high_severity_count": 0,
        "affected_records_count": 0,
        "most_affected_columns": {},
        "anomaly_types_distribution": {},
        "data_quality_vs_business": {}
    }
    
    overall_algorithm = "Isolation Forest (Ensemble Tree ML) + Robust IQR & Z-score"
    total_sample_size = 0
    ml_active_any = False
    status_overall = "success"

    for s_name in sheets_to_process:
        key = f"{dataset_id}_{s_name}"
        if key in store.active_dataframes:
            df = store.active_dataframes[key]
        elif dataset_id in store.active_dataframes and (s_name == "Default" or len(available_sheets) == 1):
            df = store.active_dataframes[dataset_id]
        else:
            continue

        sheet_res = detect_comprehensive_anomalies(
            df=df,
            sheet_name=s_name,
            target_metric=metric if metric and metric != "all" else None,
            group_by_col=group_by if group_by and group_by != "" else None,
            contamination=contamination
        )

        total_sample_size += sheet_res.get("sample_size", 0)
        if sheet_res.get("ml_engine_active", False):
            ml_active_any = True

        all_anomalies.extend(sheet_res.get("anomalies", []))
        s_sum = sheet_res.get("summary", {})
        combined_summary["total_anomalies"] += s_sum.get("total_anomalies", 0)
        combined_summary["high_severity_count"] += s_sum.get("high_severity_count", 0)
        combined_summary["affected_records_count"] += s_sum.get("affected_records_count", 0)

        # Merge distributions
        for col_name, cnt in s_sum.get("most_affected_columns", {}).items():
            combined_summary["most_affected_columns"][col_name] = combined_summary["most_affected_columns"].get(col_name, 0) + cnt

        for a_type, cnt in s_sum.get("anomaly_types_distribution", {}).items():
            combined_summary["anomaly_types_distribution"][a_type] = combined_summary["anomaly_types_distribution"].get(a_type, 0) + cnt

        for n_type, cnt in s_sum.get("data_quality_vs_business", {}).items():
            combined_summary["data_quality_vs_business"][n_type] = combined_summary["data_quality_vs_business"].get(n_type, 0) + cnt

    # Sort critical first, then anomaly score descending
    severity_order = {"Critical": 0, "Medium": 1, "Low": 2}
    all_anomalies.sort(key=lambda x: (severity_order.get(x['severity'], 3), -x.get('anomaly_score', 0.0)))

    return {
        "success": True,
        "data": {
            "status": status_overall,
            "sheets_analyzed": sheets_to_process,
            "sample_size": total_sample_size,
            "target_metric": metric or "All Columns",
            "ml_engine_active": ml_active_any,
            "ml_algorithm": overall_algorithm if ml_active_any else "Robust Statistical (IQR & Z-score Boundaries)",
            "total_anomalies_detected": len(all_anomalies),
            "anomalies": all_anomalies,
            "summary": combined_summary
        }
    }

class EvaluateRulesPayload(BaseModel):
    dataset_id: str
    rules: List[BusinessRule]
    exceptions: List[ApprovedException]

@app.post("/api/rules/evaluate")
def evaluate_rules(payload: EvaluateRulesPayload):
    """Evaluates business rules against data with approved exception checks."""
    if payload.dataset_id not in store.active_dataframes:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = store.active_dataframes[payload.dataset_id]
    res = evaluate_business_rules(df, payload.rules, payload.exceptions)
    return {"success": True, "data": res}

@app.get("/api/visualizations")
def get_visualizations(dataset_id: str):
    """Automatically recommends and constructs data charts."""
    if dataset_id not in store.active_dataframes:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = store.active_dataframes[dataset_id]
    charts = recommend_visualizations(df)
    return {"success": True, "charts": charts}

@app.get("/api/predict_and_insights")
def get_predict_and_insights(dataset_id: str):
    """Predictive trend analytics & evidence-based natural language insights."""
    if dataset_id not in store.active_dataframes:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = store.active_dataframes[dataset_id]
    res = generate_predictions_and_insights(df)
    return {"success": True, "data": res}

@app.get("/api/search")
def search_dataset(
    dataset_id: str,
    query: str = Query(..., min_length=1),
    sheet: Optional[str] = None,
    column: Optional[str] = None,
    fuzzy: bool = True,
    fuzzy_threshold: float = 0.75,
    page: int = 1,
    page_size: int = 25,
    sort_by: Optional[str] = None,
    sort_asc: bool = True
):
    """
    Universal Excel search and natural-language queries across worksheets and columns.
    Supports exact, partial, and fuzzy matching, spoken numbers, and entity comparisons.
    """
    if dataset_id not in store.raw_dataframes and dataset_id not in store.active_dataframes:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        res = execute_universal_search(
            dataset_id=dataset_id,
            query=query,
            selected_sheet=sheet,
            selected_column=column,
            fuzzy=fuzzy,
            fuzzy_threshold=fuzzy_threshold,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_asc=sort_asc
        )
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/column_stats")
def get_column_stats(dataset_id: str, column: str, sheet: Optional[str] = None):
    """Returns quick descriptive statistical exploration for any single column."""
    key = f"{dataset_id}_{sheet}" if sheet and sheet != "all" else dataset_id
    if key not in store.active_dataframes:
        if dataset_id not in store.active_dataframes:
            raise HTTPException(status_code=404, detail="Dataset not found")
        df = store.active_dataframes[dataset_id]
    else:
        df = store.active_dataframes[key]

    if column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{column}' not found in dataset")

    stats = compute_column_stats(df[column])
    return {"success": True, "column": column, "data": stats}

# Serve production frontend if built (e.g. inside Docker or production build)
frontend_dist = project_root / "frontend" / "dist"
if not frontend_dist.is_dir():
    frontend_dist = Path("/app/frontend/dist")

if frontend_dist.is_dir() and (frontend_dist / "index.html").is_file():
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    if (frontend_dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json") or full_path.startswith("redoc"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

