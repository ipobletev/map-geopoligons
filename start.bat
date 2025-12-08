@echo off
echo Starting Map Geopoligons Services...

:: Start Backend
echo Starting Backend...
cd backend
if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat
echo Installing requirements...
pip install -r requirements.txt

start "Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

:: Start Frontend
echo Starting Frontend...
cd web-wizard
start "Frontend" cmd /k "npm run dev"
cd ..

echo Services started in separate windows.
