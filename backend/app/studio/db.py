import os
import io
import json
import sqlite3
import datetime
import uuid
import re
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
DB_PATH = os.path.join(DB_DIR, "apps.db")

def get_db_connection() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_master_tables():
    """Initializes master metadata tables for AI-generated applications."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS apps (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                domain TEXT,
                icon TEXT DEFAULT 'Layers',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                blueprint_json TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS app_entities (
                id TEXT PRIMARY KEY,
                app_id TEXT NOT NULL,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                table_name TEXT NOT NULL,
                primary_key TEXT NOT NULL,
                schema_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
            )
        """)
        conn.commit()

# Ensure master tables exist on load
init_master_tables()

def clean_sql_identifier(name: str) -> str:
    """Sanitizes names into safe SQL identifiers."""
    cleaned = re.sub(r'[^a-zA-Z0-9_]', '_', name).strip('_')
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"col_{cleaned}"
    return cleaned

def map_field_type_to_sqlite(field_type: str) -> str:
    """Maps semantic field types to SQLite column types."""
    t = field_type.lower()
    if t in ['integer', 'int']:
        return "INTEGER"
    elif t in ['number', 'float', 'currency', 'percentage']:
        return "REAL"
    else:
        return "TEXT"

def create_application_from_blueprint(
    app_name: str,
    description: str,
    domain: str,
    blueprint: Dict[str, Any],
    sheets_data: Dict[str, pd.DataFrame]
) -> Dict[str, Any]:
    """
    Creates a new persistent application:
    1. Registers app metadata in master SQLite tables.
    2. Dynamically creates persistent SQLite tables for each entity.
    3. Seeds the tables with the parsed workbook data.
    """
    app_id = f"app_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    with get_db_connection() as conn:
        # Save master app record
        conn.execute(
            """
            INSERT INTO apps (id, name, description, domain, icon, created_at, updated_at, blueprint_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app_id,
                app_name,
                description,
                domain,
                blueprint.get("icon", "Layers"),
                now_iso,
                now_iso,
                json.dumps(blueprint)
            )
        )

        entities_created = []

        for entity_meta in blueprint.get("entities", []):
            entity_id = f"ent_{uuid.uuid4().hex[:8]}"
            entity_name = entity_meta["entity_name"]
            display_name = entity_meta.get("display_name", entity_name)
            safe_table_name = f"data_{app_id}_{clean_sql_identifier(entity_name).lower()}"
            pk_col = entity_meta["primary_key"]
            source_sheet = entity_meta.get("source_sheet", entity_name)
            
            # Find the dataframe for this entity
            df = sheets_data.get(source_sheet)
            if df is None and len(sheets_data) == 1:
                df = list(sheets_data.values())[0]

            fields = entity_meta["fields"]
            col_definitions = []
            
            # Designate strictly ONE single primary key column
            clean_pk = clean_sql_identifier(pk_col) if pk_col else None
            field_clean_names = [clean_sql_identifier(f["name"]) for f in fields]
            if not clean_pk or clean_pk not in field_clean_names:
                # Prefer field flagged is_primary_key or fallback to first column
                pk_f = next((f for f in fields if f.get("is_primary_key")), fields[0] if fields else None)
                clean_pk = clean_sql_identifier(pk_f["name"]) if pk_f else "id"

            # Build SQL schema ensuring exactly one PRIMARY KEY column
            pk_assigned = False
            for f in fields:
                col_name = clean_sql_identifier(f["name"])
                sql_type = map_field_type_to_sqlite(f["type"])
                if col_name == clean_pk and not pk_assigned:
                    col_definitions.append(f'"{col_name}" {sql_type} PRIMARY KEY')
                    pk_assigned = True
                    f["is_primary_key"] = True
                else:
                    col_definitions.append(f'"{col_name}" {sql_type}')
                    f["is_primary_key"] = False

            # Fallback if no column was marked as PK
            if not pk_assigned:
                col_definitions.insert(0, '"id" TEXT PRIMARY KEY')
                clean_pk = "id"

            # Add internal audit columns
            col_definitions.append('"_created_at" TEXT')
            col_definitions.append('"_updated_at" TEXT')

            create_table_sql = f'CREATE TABLE IF NOT EXISTS "{safe_table_name}" (\n  ' + ",\n  ".join(col_definitions) + "\n)"
            conn.execute(create_table_sql)

            # Insert metadata
            conn.execute(
                """
                INSERT INTO app_entities (id, app_id, name, display_name, table_name, primary_key, schema_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entity_id,
                    app_id,
                    entity_name,
                    display_name,
                    safe_table_name,
                    clean_pk,
                    json.dumps(fields),
                    now_iso
                )
            )

            # Seed records from dataframe if present
            if df is not None and len(df) > 0:
                rows_to_insert = []
                cols_to_use = [f["name"] for f in fields]
                clean_cols_to_use = [clean_sql_identifier(c) for c in cols_to_use]
                placeholders = ", ".join(["?"] * (len(clean_cols_to_use) + 2))
                cols_clause = ", ".join([f'"{c}"' for c in clean_cols_to_use]) + ', "_created_at", "_updated_at"'
                insert_sql = f'INSERT OR REPLACE INTO "{safe_table_name}" ({cols_clause}) VALUES ({placeholders})'

                for idx, row in df.iterrows():
                    row_vals = []
                    for f in fields:
                        orig_col = f["name"]
                        val = row.get(orig_col, None)
                        if (val is None or pd.isna(val)) and (orig_col == pk_col or f.get("is_primary_key")):
                            val = f"{clean_sql_identifier(entity_name).upper()}-{1001 + idx}"
                        elif pd.isna(val):
                            val = None
                        elif isinstance(val, (int, float)) and not np.isnan(val):
                            val = int(val) if f["type"] in ['integer', 'int'] and val % 1 == 0 else float(val)
                        elif isinstance(val, (datetime.date, datetime.datetime, pd.Timestamp)):
                            val = val.isoformat()
                        else:
                            val = str(val)
                        row_vals.append(val)

                    row_vals.append(now_iso)
                    row_vals.append(now_iso)
                    rows_to_insert.append(row_vals)

                conn.executemany(insert_sql, rows_to_insert)

            entities_created.append({
                "id": entity_id,
                "name": entity_name,
                "display_name": display_name,
                "table_name": safe_table_name,
                "primary_key": clean_sql_identifier(pk_col),
                "total_records": len(df) if df is not None else 0
            })

        conn.commit()

    return {
        "app_id": app_id,
        "name": app_name,
        "domain": domain,
        "entities": entities_created,
        "created_at": now_iso
    }

def list_applications() -> List[Dict[str, Any]]:
    """Lists all created applications with summary stats."""
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT * FROM apps ORDER BY created_at DESC")
        apps = []
        for row in cursor.fetchall():
            app_id = row["id"]
            # Count entities and records
            ent_cursor = conn.execute("SELECT * FROM app_entities WHERE app_id = ?", (app_id,))
            entities = []
            total_records = 0
            for ent_row in ent_cursor.fetchall():
                tbl = ent_row["table_name"]
                try:
                    count_cursor = conn.execute(f'SELECT COUNT(*) as cnt FROM "{tbl}"')
                    cnt = count_cursor.fetchone()["cnt"]
                except Exception:
                    cnt = 0
                total_records += cnt
                entities.append({
                    "id": ent_row["id"],
                    "name": ent_row["name"],
                    "display_name": ent_row["display_name"],
                    "primary_key": ent_row["primary_key"],
                    "records_count": cnt
                })

            apps.append({
                "id": app_id,
                "name": row["name"],
                "description": row["description"],
                "domain": row["domain"],
                "icon": row["icon"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "total_records": total_records,
                "entities_count": len(entities),
                "entities": entities
            })
        return apps

def get_application(app_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves complete details of an application including its blueprint and entities."""
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT * FROM apps WHERE id = ?", (app_id,))
        app_row = cursor.fetchone()
        if not app_row:
            return None

        ent_cursor = conn.execute("SELECT * FROM app_entities WHERE app_id = ?", (app_id,))
        entities = []
        total_records = 0
        for ent in ent_cursor.fetchall():
            tbl = ent["table_name"]
            try:
                cnt_cur = conn.execute(f'SELECT COUNT(*) as cnt FROM "{tbl}"')
                cnt = cnt_cur.fetchone()["cnt"]
            except Exception:
                cnt = 0
            total_records += cnt
            
            entities.append({
                "id": ent["id"],
                "name": ent["name"],
                "display_name": ent["display_name"],
                "table_name": ent["table_name"],
                "primary_key": ent["primary_key"],
                "fields": json.loads(ent["schema_json"]),
                "records_count": cnt
            })

        blueprint = json.loads(app_row["blueprint_json"])

        return {
            "id": app_id,
            "name": app_row["name"],
            "description": app_row["description"],
            "domain": app_row["domain"],
            "icon": app_row["icon"],
            "created_at": app_row["created_at"],
            "updated_at": app_row["updated_at"],
            "total_records": total_records,
            "blueprint": blueprint,
            "entities": entities
        }

def delete_application(app_id: str) -> bool:
    """Deletes an application and drops all its data tables."""
    with get_db_connection() as conn:
        ent_cursor = conn.execute("SELECT table_name FROM app_entities WHERE app_id = ?", (app_id,))
        tables = [r["table_name"] for r in ent_cursor.fetchall()]
        
        # Drop all entity tables
        for tbl in tables:
            conn.execute(f'DROP TABLE IF EXISTS "{tbl}"')
            
        conn.execute("DELETE FROM apps WHERE id = ?", (app_id,))
        conn.commit()
        return True

def get_entity_records(
    app_id: str,
    entity_name: str,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_asc: bool = True,
    filters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Retrieves paginated, filtered, searched records for a generated entity."""
    with get_db_connection() as conn:
        ent_cur = conn.execute(
            "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
            (app_id, entity_name.lower(), entity_name.lower())
        )
        entity = ent_cur.fetchone()
        if not entity:
            raise KeyError(f"Entity '{entity_name}' not found in application {app_id}")

        tbl = entity["table_name"]
        fields = json.loads(entity["schema_json"])
        pk_col = entity["primary_key"]

        where_clauses = []
        params = []

        # Global search across text fields
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            search_clauses = []
            for f in fields:
                clean_name = clean_sql_identifier(f["name"])
                search_clauses.append(f'CAST("{clean_name}" AS TEXT) LIKE ?')
                params.append(search_term)
            where_clauses.append(f"({' OR '.join(search_clauses)})")

        # Column-specific filters
        if filters:
            for col, val in filters.items():
                if val is not None and str(val).strip() != '' and str(val).strip() != 'all':
                    clean_name = clean_sql_identifier(col)
                    where_clauses.append(f'"{clean_name}" = ?')
                    params.append(val)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        # Total count
        count_sql = f'SELECT COUNT(*) as total FROM "{tbl}" {where_sql}'
        count_res = conn.execute(count_sql, params).fetchone()
        total_rows = count_res["total"] if count_res else 0

        # Sorting
        order_col = clean_sql_identifier(sort_by) if sort_by else pk_col
        direction = "ASC" if sort_asc else "DESC"
        order_sql = f'ORDER BY "{order_col}" {direction}'

        # Pagination
        offset = max(0, (page - 1) * page_size)
        query_sql = f'SELECT * FROM "{tbl}" {where_sql} {order_sql} LIMIT ? OFFSET ?'
        query_params = list(params) + [page_size, offset]

        rows = conn.execute(query_sql, query_params).fetchall()
        records = [dict(r) for r in rows]

        total_pages = max(1, (total_rows + page_size - 1) // page_size)

        return {
            "entity_name": entity["name"],
            "display_name": entity["display_name"],
            "primary_key": pk_col,
            "fields": fields,
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "total_pages": total_pages,
            "records": records
        }

def get_record(app_id: str, entity_name: str, record_id: Any) -> Optional[Dict[str, Any]]:
    """Gets a single record by primary key, plus lookups for related foreign entities."""
    with get_db_connection() as conn:
        ent_cur = conn.execute(
            "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
            (app_id, entity_name.lower(), entity_name.lower())
        )
        entity = ent_cur.fetchone()
        if not entity:
            return None

        tbl = entity["table_name"]
        pk_col = entity["primary_key"]
        fields = json.loads(entity["schema_json"])

        row = conn.execute(f'SELECT * FROM "{tbl}" WHERE "{pk_col}" = ?', (str(record_id),)).fetchone()
        if not row:
            return None

        record = dict(row)

        # Lookup foreign key details
        relations = {}
        for f in fields:
            fk = f.get("foreign_key")
            if fk and f["name"] in record and record[f["name"]]:
                target_sheet = fk.get("target_sheet")
                target_field = fk.get("target_field")
                if target_sheet and target_field:
                    # Find target entity
                    t_cur = conn.execute(
                        "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
                        (app_id, target_sheet.lower(), target_sheet.lower())
                    )
                    t_ent = t_cur.fetchone()
                    if t_ent:
                        t_tbl = t_ent["table_name"]
                        t_clean_field = clean_sql_identifier(target_field)
                        rel_row = conn.execute(
                            f'SELECT * FROM "{t_tbl}" WHERE "{t_clean_field}" = ?',
                            (str(record[f["name"]]),)
                        ).fetchone()
                        if rel_row:
                            relations[f["name"]] = dict(rel_row)

        return {
            "record": record,
            "relations": relations,
            "fields": fields,
            "primary_key": pk_col
        }

def create_record(app_id: str, entity_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a new record with validation into the entity table."""
    with get_db_connection() as conn:
        ent_cur = conn.execute(
            "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
            (app_id, entity_name.lower(), entity_name.lower())
        )
        entity = ent_cur.fetchone()
        if not entity:
            raise KeyError(f"Entity '{entity_name}' not found")

        tbl = entity["table_name"]
        fields = json.loads(entity["schema_json"])
        pk_col = entity["primary_key"]
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Generate PK if missing
        if pk_col not in data or not data[pk_col]:
            data[pk_col] = f"{clean_sql_identifier(entity_name).upper()}-{uuid.uuid4().hex[:6].upper()}"

        # Validate required fields
        for f in fields:
            fname = f["name"]
            if f.get("required") and (fname not in data or data[fname] is None or str(data[fname]).strip() == ''):
                raise ValueError(f"Field '{f['label']}' is required")

        insert_cols = []
        insert_vals = []
        for f in fields:
            clean_name = clean_sql_identifier(f["name"])
            val = data.get(f["name"], None)
            # Type cast
            if val is not None and str(val).strip() != '':
                if f["type"] in ['integer', 'int']:
                    val = int(val)
                elif f["type"] in ['number', 'currency', 'percentage', 'float']:
                    val = float(val)
            else:
                val = None
            insert_cols.append(f'"{clean_name}"')
            insert_vals.append(val)

        insert_cols.append('"_created_at"')
        insert_vals.append(now_iso)
        insert_cols.append('"_updated_at"')
        insert_vals.append(now_iso)

        placeholders = ", ".join(["?"] * len(insert_vals))
        sql = f'INSERT INTO "{tbl}" ({", ".join(insert_cols)}) VALUES ({placeholders})'
        conn.execute(sql, insert_vals)
        conn.commit()

        # Update app timestamp
        conn.execute("UPDATE apps SET updated_at = ? WHERE id = ?", (now_iso, app_id))
        conn.commit()

        return get_record(app_id, entity_name, data[pk_col])

def update_record(app_id: str, entity_name: str, record_id: Any, data: Dict[str, Any]) -> Dict[str, Any]:
    """Updates an existing record with validation."""
    with get_db_connection() as conn:
        ent_cur = conn.execute(
            "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
            (app_id, entity_name.lower(), entity_name.lower())
        )
        entity = ent_cur.fetchone()
        if not entity:
            raise KeyError(f"Entity '{entity_name}' not found")

        tbl = entity["table_name"]
        fields = json.loads(entity["schema_json"])
        pk_col = entity["primary_key"]
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Verify existence
        chk = conn.execute(f'SELECT 1 FROM "{tbl}" WHERE "{pk_col}" = ?', (str(record_id),)).fetchone()
        if not chk:
            raise KeyError(f"Record with ID '{record_id}' not found")

        # Validate required fields
        for f in fields:
            fname = f["name"]
            if fname in data and f.get("required") and (data[fname] is None or str(data[fname]).strip() == ''):
                raise ValueError(f"Field '{f['label']}' cannot be empty")

        set_clauses = []
        set_vals = []
        for f in fields:
            if f["name"] == pk_col:
                continue
            if f["name"] in data:
                clean_name = clean_sql_identifier(f["name"])
                val = data[f["name"]]
                if val is not None and str(val).strip() != '':
                    if f["type"] in ['integer', 'int']:
                        val = int(val)
                    elif f["type"] in ['number', 'currency', 'percentage', 'float']:
                        val = float(val)
                else:
                    val = None
                set_clauses.append(f'"{clean_name}" = ?')
                set_vals.append(val)

        set_clauses.append('"_updated_at" = ?')
        set_vals.append(now_iso)

        set_vals.append(str(record_id))
        update_sql = f'UPDATE "{tbl}" SET {", ".join(set_clauses)} WHERE "{pk_col}" = ?'
        conn.execute(update_sql, set_vals)
        conn.commit()

        conn.execute("UPDATE apps SET updated_at = ? WHERE id = ?", (now_iso, app_id))
        conn.commit()

        return get_record(app_id, entity_name, record_id)

def delete_record(app_id: str, entity_name: str, record_id: Any) -> bool:
    """Deletes a record from the entity table."""
    with get_db_connection() as conn:
        ent_cur = conn.execute(
            "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
            (app_id, entity_name.lower(), entity_name.lower())
        )
        entity = ent_cur.fetchone()
        if not entity:
            raise KeyError(f"Entity '{entity_name}' not found")

        tbl = entity["table_name"]
        pk_col = entity["primary_key"]

        conn.execute(f'DELETE FROM "{tbl}" WHERE "{pk_col}" = ?', (str(record_id),))
        conn.commit()
        return True

def add_custom_field(app_id: str, entity_name: str, field_def: Dict[str, Any]) -> Dict[str, Any]:
    """Adds a new custom field to an entity table (ALTER TABLE) and updates schema."""
    field_name = field_def["name"]
    clean_name = clean_sql_identifier(field_name)
    field_type = field_def.get("type", "text")
    sql_type = map_field_type_to_sqlite(field_type)

    with get_db_connection() as conn:
        ent_cur = conn.execute(
            "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
            (app_id, entity_name.lower(), entity_name.lower())
        )
        entity = ent_cur.fetchone()
        if not entity:
            raise KeyError(f"Entity '{entity_name}' not found")

        tbl = entity["table_name"]
        fields = json.loads(entity["schema_json"])

        # Check duplicate field
        if any(f["name"].lower() == field_name.lower() for f in fields):
            raise ValueError(f"Field '{field_name}' already exists in this entity")

        # Alter table
        alter_sql = f'ALTER TABLE "{tbl}" ADD COLUMN "{clean_name}" {sql_type}'
        conn.execute(alter_sql)

        new_field_meta = {
            "name": clean_name,
            "label": field_def.get("label", clean_name.replace('_', ' ').title()),
            "type": field_type,
            "required": field_def.get("required", False),
            "is_primary_key": False,
            "options": field_def.get("options", []),
            "validation": field_def.get("validation", {}),
            "sample_values": []
        }
        fields.append(new_field_meta)

        conn.execute(
            "UPDATE app_entities SET schema_json = ? WHERE id = ?",
            (json.dumps(fields), entity["id"])
        )
        conn.commit()
        return new_field_meta

def get_app_dashboard(app_id: str) -> Dict[str, Any]:
    """Computes real-time executive dashboard KPIs, charts, and activity for the generated app."""
    with get_db_connection() as conn:
        app_cur = conn.execute("SELECT * FROM apps WHERE id = ?", (app_id,))
        app_row = app_cur.fetchone()
        if not app_row:
            raise KeyError(f"Application {app_id} not found")

        ent_cursor = conn.execute("SELECT * FROM app_entities WHERE app_id = ?", (app_id,))
        entities = ent_cursor.fetchall()

        kpis = []
        charts = []
        recent_activity = []

        for ent in entities:
            tbl = ent["table_name"]
            fields = json.loads(ent["schema_json"])
            pk_col = ent["primary_key"]

            # Record count KPI
            cnt_cur = conn.execute(f'SELECT COUNT(*) as cnt FROM "{tbl}"')
            cnt = cnt_cur.fetchone()["cnt"]

            kpis.append({
                "label": f"Total {ent['display_name']}s",
                "value": cnt,
                "type": "count",
                "entity": ent["name"]
            })

            # Check numerical aggregates
            for f in fields:
                if f["type"] in ['currency', 'number', 'percentage'] and not f.get("is_primary_key"):
                    clean_name = clean_sql_identifier(f["name"])
                    try:
                        agg_cur = conn.execute(
                            f'SELECT SUM("{clean_name}") as total, AVG("{clean_name}") as average FROM "{tbl}"'
                        )
                        agg = agg_cur.fetchone()
                        if agg and agg["total"] is not None:
                            val_sum = round(float(agg["total"]), 2)
                            val_avg = round(float(agg["average"]), 2)
                            if f["type"] == 'currency':
                                kpis.append({
                                    "label": f"Total {f['label']}",
                                    "value": f"${val_sum:,.2f}",
                                    "type": "currency",
                                    "entity": ent["name"]
                                })
                            else:
                                kpis.append({
                                    "label": f"Avg {f['label']}",
                                    "value": f"{val_avg:,.2f}",
                                    "type": "number",
                                    "entity": ent["name"]
                                })
                            break
                    except Exception:
                        pass

            # Fetch categorical distribution chart
            for f in fields:
                if f["type"] == 'category':
                    clean_name = clean_sql_identifier(f["name"])
                    try:
                        cat_cur = conn.execute(
                            f'SELECT "{clean_name}" as name, COUNT(*) as value FROM "{tbl}" WHERE "{clean_name}" IS NOT NULL GROUP BY "{clean_name}" ORDER BY value DESC LIMIT 8'
                        )
                        cat_data = [dict(r) for r in cat_cur.fetchall()]
                        if cat_data:
                            charts.append({
                                "id": f"chart_{ent['name']}_{clean_name}",
                                "title": f"{ent['display_name']} by {f['label']}",
                                "type": "bar",
                                "x_axis": "name",
                                "y_axis": "value",
                                "data": cat_data,
                                "entity": ent["name"]
                            })
                            break
                    except Exception:
                        pass

            # Fetch recent records
            try:
                rec_cur = conn.execute(
                    f'SELECT * FROM "{tbl}" ORDER BY _created_at DESC LIMIT 5'
                )
                for r in rec_cur.fetchall():
                    r_dict = dict(r)
                    recent_activity.append({
                        "entity": ent["display_name"],
                        "id": r_dict.get(pk_col, "N/A"),
                        "timestamp": r_dict.get("_created_at", app_row["created_at"]),
                        "summary": str(list(r_dict.values())[1]) if len(r_dict) > 1 else "Record created"
                    })
            except Exception:
                pass

        return {
            "app_id": app_id,
            "app_name": app_row["name"],
            "domain": app_row["domain"],
            "description": app_row["description"],
            "kpis": kpis[:6],
            "charts": charts[:4],
            "recent_activity": recent_activity[:8]
        }

def export_entity_records(app_id: str, entity_name: str, format_type: str = "csv") -> Tuple[str, bytes]:
    """Exports all records for an entity in CSV, XLSX, or JSON format."""
    with get_db_connection() as conn:
        ent_cur = conn.execute(
            "SELECT * FROM app_entities WHERE app_id = ? AND (LOWER(name) = ? OR LOWER(display_name) = ?)",
            (app_id, entity_name.lower(), entity_name.lower())
        )
        entity = ent_cur.fetchone()
        if not entity:
            raise KeyError(f"Entity '{entity_name}' not found")

        tbl = entity["table_name"]
        df = pd.read_sql_query(f'SELECT * FROM "{tbl}"', conn)
        # Drop internal audit columns for clean export
        for c in ['_created_at', '_updated_at']:
            if c in df.columns:
                df.drop(columns=[c], inplace=True)

        if format_type == "json":
            content = df.to_json(orient="records", indent=2).encode('utf-8')
            filename = f"{entity['name'].lower()}_export.json"
        elif format_type in ["xlsx", "excel"]:
            out = io.BytesIO()
            with pd.ExcelWriter(out, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name=entity['display_name'][:31], index=False)
            content = out.getvalue()
            filename = f"{entity['name'].lower()}_export.xlsx"
        else: # csv
            content = df.to_csv(index=False).encode('utf-8')
            filename = f"{entity['name'].lower()}_export.csv"

        return filename, content
