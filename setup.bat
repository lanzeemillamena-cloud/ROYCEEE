@echo off
echo ============================================
echo EMJ Advertising Service - Time In/Out System
echo ============================================
echo.

echo Starting frontend server on http://localhost:3000
echo.

start "Frontend Server" cmd /k "npx serve . -l 3000"

timeout /t 5 /nobreak >nul

echo ============================================
echo System is ready!
echo.
echo Open your browser and go to:
echo   http://localhost:3000/attendence.html
echo.
echo Admin Panel:
echo   http://localhost:3000/admin.html
echo.
echo Press any key to close this window.
echo ============================================
pause >nul
