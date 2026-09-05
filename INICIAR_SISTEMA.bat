@echo off
chcp 65001 >nul
title Sistema de Asistencia Docente
cd /d "%~dp0"

echo ================================================
echo   SISTEMA DE CONTROL DE ASISTENCIA DOCENTE
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado.
    pause
    exit /b 1
)

if not exist ".env" copy ".env.example" ".env" >nul

if not exist "node_modules\express" (
    echo Instalando dependencias desde npmjs.org...
    call npm install --registry=https://registry.npmjs.org/
    if errorlevel 1 (
        echo.
        echo ERROR: La instalacion no termino correctamente.
        echo Revisa la conexion a Internet y vuelve a ejecutar este archivo.
        pause
        exit /b 1
    )
)

echo.
echo Iniciando servidor...
echo No cierres esta ventana mientras utilices el sistema.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
call npm start

echo.
echo El servidor se detuvo.
pause
