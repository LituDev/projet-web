@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  gumes marketplace — lancement complet (dev)
REM
REM  Chaque demarrage reinitialise la base : teardown + up + migrations + seed.
REM  Puis ouvre deux fenetres : serveur (Express :3000) et client (Vite :5173).
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
echo --^> Demarrage de PostgreSQL/PostGIS + Adminer...
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
if not exist node_modules (
  echo --^> Installation des dependances npm...
  call npm install
)

REM ── Migrations + seed ───────────────────────────────────────────────────────
echo --^> Application des migrations...
call npm run db:migrate
if errorlevel 1 (echo Echec des migrations. & exit /b 1)

echo --^> Seed des donnees de test...
call npm run db:seed
if errorlevel 1 (echo Echec du seed. & exit /b 1)

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
