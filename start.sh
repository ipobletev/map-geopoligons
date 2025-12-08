#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo "Stopping services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT

# Start Backend
echo "Starting Backend..."
cd backend
# Check if venv exists and activate it
# Check if venv exists, create if not
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

echo "Installing requirements..."
pip install -r requirements.txt
if [ -f ".venv/Scripts/uvicorn.exe" ]; then
    ./.venv/Scripts/uvicorn.exe main:app --reload --host 0.0.0.0 --port 8000 &
elif [ -f ".venv/Scripts/uvicorn" ]; then
    ./.venv/Scripts/uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
elif [ -f ".venv/bin/uvicorn" ]; then
    ./.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
else
    uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
fi
cd ..

# Start Frontend
echo "Starting Frontend..."
cd web-wizard
npm run dev &
cd ..

echo "Services started. Press Ctrl+C to stop."
wait
