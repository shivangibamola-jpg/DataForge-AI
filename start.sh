#!/usr/bin/env bash
# ==============================================================================
# DataForge AI - Self-Healing Startup Script (macOS / Linux)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================================="
echo "          🚀 Launching DataForge AI Platform                      "
echo "=================================================================="

# 1. Verify Prerequisites
echo "[Step 1/5] Checking runtime prerequisites..."

# Python detection (prefer python3)
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python 3 is not installed or not in PATH."
    echo "   Please install Python 3.9+ from https://www.python.org/"
    exit 1
fi
echo "  ✓ Found Python: $($PYTHON_CMD --version)"

# Node.js detection
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Error: Node.js is not installed or not in PATH."
    echo "   Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
echo "  ✓ Found Node.js: $(node --version)"

# npm detection
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ Error: npm is not installed or not in PATH."
    exit 1
fi
echo "  ✓ Found npm: $(npm --version)"

# 2. Setup / Verify Backend Environment
echo "[Step 2/5] Preparing Python Virtual Environment..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "venv" ]; then
    echo "  Creating virtual environment in backend/venv..."
    $PYTHON_CMD -m venv venv
    source venv/bin/activate
    echo "  Installing backend dependencies from requirements.txt..."
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Ensure data directory exists
mkdir -p "$SCRIPT_DIR/backend/data"

# 3. Setup / Verify Frontend Dependencies
echo "[Step 3/5] Checking Frontend Dependencies..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "  Installing frontend packages (npm install)..."
    npm install
fi

# 4. Free Lingering Ports (8080 & 3000)
echo "[Step 4/5] Checking network ports 8080 and 3000..."
cd "$SCRIPT_DIR"
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti :8080 -ti :3000 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "  Freeing lingering process(es) on ports 8080/3000: $PIDS"
        kill -9 $PIDS 2>/dev/null || true
        sleep 1
    fi
fi

# 5. Launch Backend & Frontend
echo "[Step 5/5] Starting services..."

# Start Backend
cd "$SCRIPT_DIR/backend"
export PYTHONPATH="$SCRIPT_DIR/backend"
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload &
BACKEND_PID=$!

# Start Frontend
cd "$SCRIPT_DIR/frontend"
npm run dev -- --port 3000 --host 127.0.0.1 &
FRONTEND_PID=$!

echo "=================================================================="
echo "  🎉 DataForge AI is running!"
echo "  👉 Web UI:         http://127.0.0.1:3000"
echo "  👉 REST API Docs:  http://127.0.0.1:8080/docs"
echo "  Press Ctrl+C to terminate both servers cleanly."
echo "=================================================================="

cleanup() {
    echo ""
    echo "Gracefully shutting down DataForge AI..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "Shutdown complete."
    exit 0
}

trap cleanup INT TERM EXIT
wait
