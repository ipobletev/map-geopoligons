@echo off
SET VENV_DIR=.venv

IF NOT EXIST "%VENV_DIR%" (
    echo Creating virtual environment...
    python -m venv %VENV_DIR%
)

echo Activating virtual environment...
call %VENV_DIR%\Scripts\activate

echo Installing requirements...
pip install -r requirements.txt

echo Running application...
python src/main.py

pause
