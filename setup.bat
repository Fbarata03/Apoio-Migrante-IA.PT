@echo off
echo.
echo  ========================================
echo   Apoio Migrante IA PT -- Setup
echo  ========================================
echo.

cd /d "%~dp0backend"

echo  [1/3] A instalar dependencias Node.js...
call npm install
if %errorlevel% neq 0 (
  echo  ERRO: npm install falhou.
  pause
  exit /b 1
)

echo.
echo  [2/3] A criar a base de dados MySQL...
echo  Certifique-se de que o MySQL esta a correr.
echo.
set /p MYSQL_USER= MySQL utilizador (ex: root):
set /p MYSQL_PASS= MySQL palavra-passe (deixe vazio se nao tiver):

if "%MYSQL_PASS%"=="" (
  mysql -u %MYSQL_USER% < ..\database\schema.sql
) else (
  mysql -u %MYSQL_USER% -p%MYSQL_PASS% < ..\database\schema.sql
)

if %errorlevel% neq 0 (
  echo  AVISO: Problema ao criar schema. Verifique se o MySQL esta a correr.
)

echo.
echo  [3/3] A criar dados de demonstracao...
call node seed.js

echo.
echo  ========================================
echo   Setup concluido!
echo   Para iniciar: cd backend ^& npm run dev
echo   Abra: http://localhost:3001
echo  ========================================
echo.
pause
