@echo off
cd web-wizard
echo Installing dependencies if needed...
call npm install
echo Starting Web Wizard...
npm run dev
pause
