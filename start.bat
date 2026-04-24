@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  gumes marketplace — lancement complet avec Docker (dev)
REM
REM  Chaque demarrage reinitialise la base : teardown + up + migrations + seed
REM  + images. Puis ouvre deux fenetres : serveur (Express :3000) et client
REM  (Vite :5173).
REM
REM  Pour un demarrage sans Docker (PostgreSQL natif), utiliser start_dev.bat.
REM ─────────────────────────────────────────────────────────────────────────────
setlocal
cd /d "%~dp0"

where docker >nul 2>&1
if errorlevel 1 (echo Erreur : docker introuvable. & exit /b 1)
where node   >nul 2>&1
if errorlevel 1 (echo Erreur : node introuvable ^(node ^>= 20 requis^). & exit /b 1)

REM ── .env ────────────────────────────────────────────────────────────────────
if not exist .env (
  echo --^> Creation du .env a partir de .env.example
  copy /Y .env.example .env >nul
  for /f "usebackq delims=" %%S in (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) do set "SECRET=%%S"
  powershell -NoProfile -Command "(Get-Content .env) -replace '^SESSION_SECRET=.*', 'SESSION_SECRET=%SECRET%' | Set-Content .env"
  echo     SESSION_SECRET genere.
)

REM ── Teardown ────────────────────────────────────────────────────────────────
echo --^> Teardown de la base ^(docker compose down -v^)...
docker compose down -v --remove-orphans 1>nul 2>nul

REM ── Up Postgres ─────────────────────────────────────────────────────────────
echo --^> Demarrage de PostgreSQL + Adminer...
docker compose up -d
if errorlevel 1 (echo Echec du docker compose up. & exit /b 1)

REM ── Attente healthcheck ─────────────────────────────────────────────────────
echo --^> Attente du healthcheck...
set /a ATTEMPTS=0
:waitloop
docker compose exec -T db pg_isready -U gumes -d gumes_marketplace >nul 2>nul
if %errorlevel%==0 goto ready
set /a ATTEMPTS+=1
if %ATTEMPTS% GEQ 60 (echo Timeout en attendant la base. & exit /b 1)
timeout /t 1 /nobreak >nul
goto waitloop
:ready
echo     Base prete.

REM ── Dependances ─────────────────────────────────────────────────────────────
set "NEED_INSTALL=0"
if not exist node_modules set "NEED_INSTALL=1"
call npm --workspace server ls sharp --depth=0 >nul 2>nul
if errorlevel 1 set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo --^> Installation des dependances npm...
  call npm install
  if errorlevel 1 (echo Echec de npm install. & exit /b 1)
)

REM ── Migrations + seed + images ──────────────────────────────────────────────
echo --^> Preparation de la base ^(migrations + seed + images^)...
call npm run db:prep
if errorlevel 1 (echo Echec de la preparation. & exit /b 1)

REM ── Lancement serveur + client (fenetres separees) ──────────────────────────
echo.
echo ======================================================================
echo   gumes marketplace est pret.
echo     - API     http://localhost:3000
echo     - Client  http://localhost:5173
echo     - Adminer http://localhost:8080
echo.
echo   Comptes de demo (mot de passe : GumesDev!2026)
echo     admin@gumes.local ^| producteur1@gumes.local ... ^| client1@gumes.local ...
echo.
echo   Ferme les fenetres pour arreter.
echo ======================================================================
echo.

start "gumes server" cmd /k "npm run dev:server"
start "gumes client" cmd /k "npm run dev:client"

endlocal
