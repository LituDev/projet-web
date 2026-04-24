@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  gumes marketplace — lancement dev local sans Docker (Windows)
REM
REM  Variante « apporte ton propre PostgreSQL » : se connecte a l'instance
REM  locale via DATABASE_URL, reset le schema public, applique migrations +
REM  seed + images, puis ouvre deux fenetres : serveur (Express :3000) et
REM  client (Vite :5173).
REM
REM  Prerequis :
REM    - PostgreSQL >= 13 installe et demarre localement (aucune extension
REM      n'est requise, gen_random_uuid() est en core PG 13+).
REM    - La base et l'utilisateur existent deja (cf. DATABASE_URL dans .env).
REM    - Node >= 20.
REM
REM  Aucun psql n'est necessaire : tout passe par Node et le driver pg.
REM
REM  Pour un demarrage clef-en-main avec Docker, utiliser start.bat.
REM ─────────────────────────────────────────────────────────────────────────────
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (echo Erreur : node introuvable ^(node ^>= 20 requis^). & exit /b 1)

REM ── .env ────────────────────────────────────────────────────────────────────
if not exist .env (
  echo --^> Creation du .env a partir de .env.example
  copy /Y .env.example .env >nul
  for /f "usebackq delims=" %%S in (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) do set "SECRET=%%S"
  powershell -NoProfile -Command "(Get-Content .env) -replace '^SESSION_SECRET=.*', 'SESSION_SECRET=%SECRET%' | Set-Content .env"
  echo     SESSION_SECRET genere.
  echo     Ajuste DATABASE_URL dans .env pour pointer sur ton PostgreSQL local.
)

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

REM ── Reset + migrations + seed + images ──────────────────────────────────────
echo --^> Preparation de la base ^(reset + migrations + seed + images^)...
call npm run db:prep
if errorlevel 1 (echo Echec de la preparation. Verifie DATABASE_URL et que PostgreSQL tourne. & exit /b 1)

REM ── Lancement serveur + client (fenetres separees) ──────────────────────────
echo.
echo ======================================================================
echo   gumes marketplace est pret (PostgreSQL natif, sans Docker).
echo     - API     http://localhost:3000
echo     - Client  http://localhost:5173
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
