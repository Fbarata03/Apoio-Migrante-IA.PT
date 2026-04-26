@echo off
title Apoio Migrante IA PT

echo.
echo  Apoio Migrante IA PT - A iniciar...
echo.

:: Verificar se o Ollama esta em execucao
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo  A iniciar Ollama...
    start "" "ollama" serve
    timeout /t 4 /nobreak >nul
) else (
    echo  Ollama ja esta em execucao.
)

:: Matar servidor anterior se existir
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Iniciar servidor Node.js
echo  A iniciar servidor na porta 3001...
cd /d "%~dp0backend"
start "" /B node server.js

timeout /t 3 /nobreak >nul

:: Abrir browser automaticamente
echo  A abrir browser...
start "" "http://localhost:3001"

echo.
echo  Servidor em execucao: http://localhost:3001
echo  Para parar: feche esta janela
echo.
pause
