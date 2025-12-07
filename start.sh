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
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
cd ..

# Start Frontend
echo "Starting Frontend..."
cd web-wizard
npm run dev &
cd ..

echo "Services started. Press Ctrl+C to stop."
wait
