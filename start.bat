@echo off
echo Starting Map Geopoligons Services...

:: Start Backend
echo Starting Backend...
cd backend
if exist .venv\Scripts\activate.bat (
    start "Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
) else (
    echo Virtual environment not found in backend\.venv. Attempting to run without activation...
    start "Backend" cmd /k "uvicorn main:app --reload --host 0.0.0.0 --port 8000"
)
cd ..

:: Start Frontend
echo Starting Frontend...
cd web-wizard
start "Frontend" cmd /k "npm run dev"
cd ..

echo Services started in separate windows.
