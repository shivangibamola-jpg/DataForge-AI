# DataForge AI

### Universal Business Data Intelligence & Anomaly Detection Platform

DataForge AI is an enterprise-grade data intelligence platform designed to ingest raw business datasets (CSV and multi-worksheet Excel workbooks), infer semantics and profiles, execute non-code reversible data cleaning, detect statistical and machine learning anomalies (Isolation Forest + IQR/Z-score), evaluate custom business rules and approved exceptions, generate predictive insights, and automatically synthesize interactive CRUD database applications with AI App Studio.

---

## 🏗️ Architecture Overview

```
                      ┌──────────────────────────────────────────┐
                      │    Modern Web Client (React 18 / Vite)   │
                      │  Tailwind CSS • Recharts • Lucide Icons  │
                      └────────────────────┬─────────────────────┘
                                           │
                         HTTP REST API (Reverse Proxy /api)
                                           │
                      ┌────────────────────▼─────────────────────┐
                      │        FastAPI Application Server        │
                      ├────────────────────┬─────────────────────┤
                      │   Universal Engine  │    AI App Studio    │
                      ├────────────────────┼─────────────────────┤
                      │ • Semantic Profiler│ • Excel Analyzer    │
                      │ • Cleaning Engine  │ • SQLite Blueprint  │
                      │ • Isolation Forest │ • Dynamic Entities  │
                      │ • Business Rules   │ • Starter Templates │
                      │ • Visualizer / Pred│ • CRUD Runner       │
                      └────────────────────┴─────────────────────┘
```

---

## ⚡ Quick Start (One-Command Startup)

The repository includes cross-platform startup scripts that automatically verify prerequisites, provision the Python virtual environment and Node modules if missing, free lingering ports, and start both servers.

### macOS / Linux
```bash
./start.sh
```

### Windows
```cmd
start.bat
```

Once running, access:
- **Web User Interface**: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **Interactive OpenAPI Docs**: [http://127.0.0.1:8080/docs](http://127.0.0.1:8080/docs)
- **Backend Health Check**: [http://127.0.0.1:8080/api/health](http://127.0.0.1:8080/api/health)

---

## 🛠️ Prerequisites & Tested Versions

| Software | Supported Versions | Notes |
| :--- | :--- | :--- |
| **Python** | 3.9, 3.10, 3.11, 3.12, 3.13 | Standard scientific stack (FastAPI, Pandas, Scikit-learn) |
| **Node.js** | 18.x, 20.x, 22.x | LTS recommended |
| **npm** | 9.x+ | Distributed with Node.js |

---

## 💻 Manual Setup (Step-by-Step)

If you prefer to run services manually in separate terminal windows:

### 1. Environment Configuration
Copy the provided environment example:
```bash
cp .env.example .env
```

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
export PYTHONPATH="$(pwd)"    # On Windows: set PYTHONPATH=%CD%
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev -- --port 3000 --host 127.0.0.1
```

---

## 🧪 Automated Testing & Verification

The project includes an end-to-end Python test suite that tests all 9 core capabilities without relying on external network access:

```bash
PYTHONPATH=backend backend/venv/bin/python3 -m unittest backend/tests/test_api.py
```

### Verified Capabilities:
1. **Universal Ingestion**: CSV and multi-worksheet Excel (.xlsx, .xls) parsing with sheet switching.
2. **Data Profiling**: Automatic column type inference (dates, currency, categories, metrics), completeness scores, and null auditing.
3. **Reversible Data Cleaning**: Non-code rule pipelines (whitespace trimming, duplicate removal, missing-value imputation).
4. **Machine Learning Anomaly Engine**: Multi-metric Isolation Forest ensemble trees combined with robust IQR and Z-score statistical boundaries.
5. **Business Rules & Exceptions**: Custom business threshold evaluations, severity tagging, and management exception tracking.
6. **Smart Visualizations**: Deterministic chart recommendations (histograms, bar distributions, scatter correlations).
7. **Predictive Analytics**: Deterministic trend regressions and evidence-based findings.
8. **AI App Studio**: Dynamic relational schema generation, SQLite entity storage, starter business templates, and full record CRUD.

---

## ☁️ Cloud Deployment (Vercel + Render)

DataForge AI is pre-configured for modern two-tier cloud deployment:

- **Frontend (Vercel)**:
  - Framework: Vite / React SPA
  - Built with `frontend/vercel.json` rewrites for client-side routing.
  - Connects to backend via environment variable: `VITE_API_BASE_URL`.

- **Backend (Render / Railway / Cloud Run)**:
  - Runtime: Python 3.11 (`.python-version` & `runtime.txt`)
  - Server: FastAPI / Uvicorn with auto-port binding via `render.yaml`.
  - Machine learning engines (Scikit-Learn, Pandas, NumPy) with pre-compiled wheels.

---

## 🐳 Docker Deployment

A multi-stage container specification is provided for single-command production deployment:

```bash
docker compose up --build
```
This builds the optimized React static frontend and serves the application through the FastAPI backend container at port `8080`.

---

## 📁 Repository Structure

```
DataForge AI/
├── backend/
│   ├── app/
│   │   ├── engine/             # Core data intelligence modules
│   │   │   ├── anomaly.py      # Isolation Forest + IQR/Z-score ML detector
│   │   │   ├── business_rules.py# Threshold checking & approved exceptions
│   │   │   ├── cleaner.py      # Non-code reversible transformation engine
│   │   │   ├── data_store.py   # In-memory dataframe session store
│   │   │   ├── predictor.py    # Trend regressions & natural language insights
│   │   │   ├── profiler.py     # Automatic semantic column classification
│   │   │   ├── search_engine.py# Universal Excel & fuzzy search engine
│   │   │   └── visualizer.py   # Dynamic chart recommendation engine
│   │   ├── routers/
│   │   │   └── studio_router.py# AI App Studio REST API endpoints
│   │   ├── studio/
│   │   │   ├── analyzer.py     # Excel workbook parser & blueprint builder
│   │   │   ├── db.py           # SQLite persistence layer for generated apps
│   │   │   └── templates.py    # Pre-built business application templates
│   │   ├── __init__.py
│   │   └── main.py             # FastAPI entrypoint & middleware configuration
│   ├── data/                   # Persistent SQLite databases (.gitkeep)
│   ├── tests/
│   │   └── test_api.py         # End-to-end automated verification suite
│   ├── requirements.txt        # Pinned Python dependencies
│   └── .env.example
├── frontend/
│   ├── public/
│   │   └── logo.jpg            # Brand logo asset
│   ├── src/
│   │   ├── components/         # Modular React UI views
│   │   │   ├── studio/         # AI App Generator studio components
│   │   │   ├── AnomalyEngine.tsx
│   │   │   ├── CleaningView.tsx
│   │   │   ├── DataExplorer.tsx
│   │   │   ├── ExecutiveDashboard.tsx
│   │   │   ├── Predictions.tsx
│   │   │   ├── RulesManager.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── UploadSection.tsx
│   │   │   └── Visualizations.tsx
│   │   ├── services/
│   │   │   └── api.ts          # REST API client with env fallback
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript schemas & interfaces
│   │   ├── App.tsx             # Main dashboard layout
│   │   ├── main.tsx            # Vite DOM entrypoint
│   │   └── vite-env.d.ts       # Vite environment type declarations
│   ├── package.json            # Pinned frontend dependencies
│   ├── package-lock.json       # Exact dependency lockfile
│   ├── tailwind.config.js      # Styling configuration
│   ├── tsconfig.json           # TypeScript build rules
│   └── vite.config.ts          # Vite build, proxy & code chunking setup
├── sample_data/
│   ├── manufacturing_operations.csv # 500 manufacturing cycle & defect records
│   └── supply_chain_multi_sheet.xlsx # Multi-sheet shipments & supplier workbook
├── .env.example                # Unified environment variables template
├── .gitignore                  # Git exclusions for OS, Python, Node, & DBs
├── Dockerfile                  # Multi-stage production container
├── docker-compose.yml          # Container service orchestrator
├── start.sh                    # Self-healing startup script for macOS/Linux
└── start.bat                   # Self-healing startup script for Windows
```

---

## 🔒 Security & Privacy

- No secrets, credentials, or machine-specific absolute file paths are committed.
- Uploaded user files are processed in-memory or persisted locally into a managed SQLite database inside `backend/data/`.
- Cross-Origin Resource Sharing (CORS) is configurable via the `CORS_ORIGINS` environment variable.
