@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==================================================
echo   LIMPIAR TODOS LOS DATOS LOCALES DEL SISTEMA
echo ==================================================
echo.
echo Se borraran docentes, horarios, asistencias,
echo dispositivos y justificantes locales.
echo La cuenta admin se recreara al iniciar el servidor.
echo.
choice /M "Desea continuar"
if errorlevel 2 exit /b

taskkill /F /IM node.exe >nul 2>&1
if exist data\asistencia.db del /f /q data\asistencia.db
if exist data\asistencia.db-wal del /f /q data\asistencia.db-wal
if exist data\asistencia.db-shm del /f /q data\asistencia.db-shm

echo.
echo Datos eliminados correctamente.
echo Ejecute INICIAR_SISTEMA.bat para crear una base vacia.
pause
