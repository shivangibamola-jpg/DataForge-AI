import uuid
import os
import io
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Response
from pydantic import BaseModel

from app.studio.analyzer import analyze_workbook
from app.studio.db import (
    create_application_from_blueprint,
    list_applications,
    get_application,
    delete_application,
    get_entity_records,
    get_record,
    create_record,
    update_record,
    delete_record,
    add_custom_field,
    get_app_dashboard,
    export_entity_records
)
from app.studio.templates import get_builtin_templates, get_template_data

router = APIRouter(prefix="/api/studio", tags=["AI App Studio"])

# Temporary in-memory cache for parsed sheets between analyze and generate steps
_analysis_cache: Dict[str, Dict[str, Any]] = {}

@router.post("/analyze")
async def analyze_uploaded_file(file: UploadFile = File(...)):
    """Uploads and analyzes Excel (.xlsx, .xls) or CSV workbook."""
    try:
        content = await file.read()
        report = analyze_workbook(content, file.filename)
        cache_id = f"cache_{uuid.uuid4().hex[:10]}"

        # Read into dataframes for caching
        ext = file.filename.split('.')[-1].lower()
        dfs = {}
        if ext in ['xlsx', 'xls']:
            xl = pd.ExcelFile(io.BytesIO(content))
            for s in xl.sheet_names:
                dfs[s] = xl.parse(s)
        else:
            dfs["Default"] = pd.read_csv(io.BytesIO(content))

        _analysis_cache[cache_id] = {
            "report": report,
            "dfs": dfs,
            "filename": file.filename
        }

        return {
            "success": True,
            "cache_id": cache_id,
            "report": report
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/analyze_sample")
def analyze_sample_dataset(sample_name: str = Query("logistics")):
    """Analyzes built-in sample dataset for fast preview."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    if not os.path.exists(os.path.join(base_dir, "sample_data")):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    sample_files = {
        "logistics": (os.path.join(base_dir, "sample_data", "supply_chain_multi_sheet.xlsx"), "supply_chain_multi_sheet.xlsx"),
        "manufacturing": (os.path.join(base_dir, "sample_data", "manufacturing_operations.csv"), "manufacturing_operations.csv")
    }

    if sample_name not in sample_files:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_name}' not found")

    filepath, filename = sample_files[sample_name]
    with open(filepath, "rb") as f:
        content = f.read()

    report = analyze_workbook(content, filename)
    cache_id = f"cache_{uuid.uuid4().hex[:10]}"

    ext = filename.split('.')[-1].lower()
    dfs = {}
    if ext in ['xlsx', 'xls']:
        xl = pd.ExcelFile(io.BytesIO(content))
        for s in xl.sheet_names:
            dfs[s] = xl.parse(s)
    else:
        dfs["Default"] = pd.read_csv(io.BytesIO(content))

    _analysis_cache[cache_id] = {
        "report": report,
        "dfs": dfs,
        "filename": filename
    }

    return {
        "success": True,
        "cache_id": cache_id,
        "report": report
    }

class GenerateAppPayload(BaseModel):
    cache_id: str
    app_name: Optional[str] = None
    description: Optional[str] = None
    blueprint: Optional[Dict[str, Any]] = None

@router.post("/generate")
def generate_application(payload: GenerateAppPayload):
    """Generates and persists a full database-backed application from analyzed blueprint."""
    if payload.cache_id not in _analysis_cache:
        raise HTTPException(status_code=404, detail="Analysis session expired. Please analyze workbook again.")

    cached = _analysis_cache[payload.cache_id]
    report = cached["report"]
    dfs = cached["dfs"]

    blueprint = payload.blueprint if payload.blueprint else report["blueprint"]
    app_name = payload.app_name or blueprint.get("app_name") or report.get("filename")
    description = payload.description or blueprint.get("description") or report.get("purpose")
    domain = report.get("domain", "General Business")

    try:
        app_res = create_application_from_blueprint(
            app_name=app_name,
            description=description,
            domain=domain,
            blueprint=blueprint,
            sheets_data=dfs
        )
        return {"success": True, "app": app_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"App generation failed: {str(e)}")

@router.get("/apps")
def get_all_applications():
    """Lists all user-generated persistent business applications."""
    try:
        apps = list_applications()
        return {"success": True, "apps": apps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/apps/{app_id}")
def get_single_application(app_id: str):
    """Retrieves full application details, entities, and blueprint."""
    app = get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{app_id}' not found")
    return {"success": True, "app": app}

@router.delete("/apps/{app_id}")
def delete_single_application(app_id: str):
    """Deletes application and drops all related SQLite tables."""
    try:
        delete_application(app_id)
        return {"success": True, "message": f"Application '{app_id}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/apps/{app_id}/dashboard")
def get_application_dashboard(app_id: str):
    """Fetches high-level KPIs, charts, and activity stream for generated app."""
    try:
        dash = get_app_dashboard(app_id)
        return {"success": True, "dashboard": dash}
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/apps/{app_id}/entities/{entity_name}/records")
def get_records(
    app_id: str,
    entity_name: str,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_asc: bool = True
):
    """Paginated, searchable, sortable records query for any entity in the app."""
    try:
        res = get_entity_records(
            app_id=app_id,
            entity_name=entity_name,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_asc=sort_asc
        )
        return {"success": True, "data": res}
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/apps/{app_id}/entities/{entity_name}/records/{record_id}")
def get_single_record(app_id: str, entity_name: str, record_id: str):
    """Inspects a single record by primary key with foreign key links."""
    res = get_record(app_id, entity_name, record_id)
    if not res:
        raise HTTPException(status_code=404, detail=f"Record '{record_id}' not found")
    return {"success": True, "data": res}

class RecordPayload(BaseModel):
    data: Dict[str, Any]

@router.post("/apps/{app_id}/entities/{entity_name}/records")
def create_new_record(app_id: str, entity_name: str, payload: RecordPayload):
    """Inserts a new record into the entity table with schema validation."""
    try:
        res = create_record(app_id, entity_name, payload.data)
        return {"success": True, "record": res}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/apps/{app_id}/entities/{entity_name}/records/{record_id}")
def update_existing_record(app_id: str, entity_name: str, record_id: str, payload: RecordPayload):
    """Updates an existing record with validation."""
    try:
        res = update_record(app_id, entity_name, record_id, payload.data)
        return {"success": True, "record": res}
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/apps/{app_id}/entities/{entity_name}/records/{record_id}")
def delete_single_record(app_id: str, entity_name: str, record_id: str):
    """Deletes a record by primary key."""
    try:
        delete_record(app_id, entity_name, record_id)
        return {"success": True, "message": "Record deleted successfully"}
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AddFieldPayload(BaseModel):
    name: str
    label: Optional[str] = None
    type: str = "text"
    required: bool = False
    options: Optional[List[str]] = None

@router.post("/apps/{app_id}/entities/{entity_name}/fields")
def add_field(app_id: str, entity_name: str, payload: AddFieldPayload):
    """Dynamically adds a custom field to the live entity table."""
    try:
        res = add_custom_field(app_id, entity_name, payload.model_dump())
        return {"success": True, "field": res}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/apps/{app_id}/entities/{entity_name}/export")
def export_records(app_id: str, entity_name: str, format: str = Query("csv")):
    """Exports entity data to CSV, XLSX, or JSON."""
    try:
        filename, content = export_entity_records(app_id, entity_name, format)
        media_types = {
            "csv": "text/csv",
            "json": "application/json",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        return Response(
            content=content,
            media_type=media_types.get(format, "text/csv"),
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates")
def list_starter_templates():
    """Lists built-in application templates."""
    return {"success": True, "templates": get_builtin_templates()}

@router.post("/templates/{template_id}/instantiate")
def instantiate_template(template_id: str):
    """1-Click launch a full persistent business application from starter templates."""
    try:
        templates = {t["id"]: t for t in get_builtin_templates()}
        if template_id not in templates:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        tpl = templates[template_id]
        dfs = get_template_data(template_id)

        # Analyze sheets data
        first_sheet_name = list(dfs.keys())[0]
        out = io.BytesIO()
        with pd.ExcelWriter(out, engine='openpyxl') as writer:
            for s, df in dfs.items():
                df.to_excel(writer, sheet_name=s[:31], index=False)
        content = out.getvalue()

        report = analyze_workbook(content, f"{tpl['name']}.xlsx")
        blueprint = report["blueprint"]
        blueprint["app_name"] = tpl["name"]
        blueprint["description"] = tpl["description"]
        blueprint["icon"] = tpl["icon"]

        app_res = create_application_from_blueprint(
            app_name=tpl["name"],
            description=tpl["description"],
            domain=tpl["domain"],
            blueprint=blueprint,
            sheets_data=dfs
        )
        return {"success": True, "app": app_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
