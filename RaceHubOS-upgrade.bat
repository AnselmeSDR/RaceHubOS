@echo off
setlocal enabledelayedexpansion
title RaceHubOS - Upgrade
cd /d "%USERPROFILE%"

echo.
echo  ====================================
echo    RaceHubOS - Upgrade
echo  ====================================
echo.

:: -------------------------------------------------------
:: 0. Check Node.js and Git
:: -------------------------------------------------------
echo  [0/8] Verification des prerequis...

where git >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERREUR: Git n'est pas installe.
    echo  Tentative d'installation via winget...
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements >nul 2>&1
    if errorlevel 1 (
        echo  Impossible d'installer Git automatiquement.
        echo  Telechargez-le manuellement: https://git-scm.com/download/win
        pause
        exit /b 1
    )
    echo  Git installe. Redemarrez ce script.
    pause
    exit /b 0
)

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js n'est pas installe.
    echo  Tentative d'installation via winget...
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo  Impossible d'installer Node.js automatiquement.
        echo  Telechargez-le manuellement: https://nodejs.org/
        pause
        exit /b 1
    )
    echo.
    echo  Node.js installe. Redemarrez ce script pour que le PATH soit mis a jour.
    pause
    exit /b 0
)

:: Check minimum version (Node 20+)
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODE_MAJOR=%%v"
if !NODE_MAJOR! LSS 20 (
    echo  ATTENTION: Node.js v!NODE_MAJOR! detecte, v20+ requis.
    echo  Mise a jour via winget...
    winget upgrade --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo  Mettez a jour manuellement: https://nodejs.org/
        pause
        exit /b 1
    )
    echo  Node.js mis a jour. Redemarrez ce script.
    pause
    exit /b 0
)

for /f "delims=" %%v in ('node -v') do echo  Node.js %%v OK
for /f "delims=" %%v in ('git --version') do echo  %%v OK
echo.

:: -------------------------------------------------------
:: 1. Stop running processes
:: -------------------------------------------------------
echo  [1/8] Arret des processus en cours...
taskkill /F /IM node.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo  OK
echo.

:: -------------------------------------------------------
:: 2. Find the source directory (latest version with data)
:: -------------------------------------------------------
set "SOURCE_DIR="

:: Use PowerShell to sort versions correctly (semver-aware)
for /f "delims=" %%d in ('powershell -NoProfile -Command "Get-ChildItem '%USERPROFILE%\RaceHubOS-v*' -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'packages\backend\prisma\dev.db') } | Sort-Object { $v = $_.Name -replace 'RaceHubOS-v',''; $parts = $v.Split('.'); [int]$parts[0]*10000 + [int]$parts[1]*100 + [int]$parts[2] } -Descending | Select-Object -First 1 -ExpandProperty FullName"') do (
    set "SOURCE_DIR=%%d"
)

if defined SOURCE_DIR (
    echo  [2/8] Source trouvee: !SOURCE_DIR!
) else (
    echo  [2/8] Aucune version precedente trouvee (installation neuve)
)
echo.

:: -------------------------------------------------------
:: 3. Clone the repo
:: -------------------------------------------------------
set "REPO_URL=https://github.com/AnselmeSDR/RaceHubOS.git"
set "TEMP_DIR=%USERPROFILE%\RaceHubOS-temp"

echo  [3/8] Telechargement de la derniere version...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
git clone --depth 1 "%REPO_URL%" "%TEMP_DIR%"
if errorlevel 1 (
    echo  ERREUR: Impossible de cloner le depot
    pause
    exit /b 1
)
echo  OK
echo.

:: -------------------------------------------------------
:: 4. Read version from package.json
:: -------------------------------------------------------
set "VERSION="
for /f "tokens=2 delims=:, " %%v in ('findstr /C:"\"version\"" "%TEMP_DIR%\package.json"') do (
    set "VERSION=%%~v"
)

if not defined VERSION (
    echo  ERREUR: Impossible de lire la version
    pause
    exit /b 1
)

set "TARGET_DIR=%USERPROFILE%\RaceHubOS-v!VERSION!"
echo  [4/8] Version detectee: v!VERSION!
echo         Destination: !TARGET_DIR!

:: Check if already exists
if exist "!TARGET_DIR!" (
    echo.
    echo  ATTENTION: Le dossier !TARGET_DIR! existe deja.
    set /p "OVERWRITE=  Ecraser ? (O/N) : "
    if /i not "!OVERWRITE!"=="O" (
        echo  Annule.
        rmdir /s /q "%TEMP_DIR%"
        pause
        exit /b 0
    )
    rmdir /s /q "!TARGET_DIR!"
)

:: Rename temp to target
move "%TEMP_DIR%" "!TARGET_DIR!" >nul
echo  OK
echo.

:: Self-update: re-exec from new version if script changed
if not defined RACEHUBOS_REEXEC (
    fc /b "%~f0" "!TARGET_DIR!\RaceHubOS-upgrade.bat" >nul 2>&1
    if errorlevel 1 (
        echo  Script d'upgrade mis a jour, relancement avec la nouvelle version...
        echo.
        set "RACEHUBOS_REEXEC=1"
        call "!TARGET_DIR!\RaceHubOS-upgrade.bat"
        exit /b
    )
)

:: -------------------------------------------------------
:: 5. Install dependencies
:: -------------------------------------------------------
echo  [5/8] Installation des dependances (npm install)...
cd /d "!TARGET_DIR!"
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo  ERREUR: npm install a echoue
    pause
    exit /b 1
)
echo  OK
echo.

:: -------------------------------------------------------
:: 6. Copy data from source
:: -------------------------------------------------------
if defined SOURCE_DIR (
    echo  [6/8] Copie des donnees depuis !SOURCE_DIR!...

    :: Copy database
    if exist "!SOURCE_DIR!\packages\backend\prisma\dev.db" (
        copy /y "!SOURCE_DIR!\packages\backend\prisma\dev.db" "!TARGET_DIR!\packages\backend\prisma\dev.db" >nul
        echo         Base de donnees copiee
    )

    :: Copy uploads
    if exist "!SOURCE_DIR!\packages\backend\public\uploads" (
        xcopy /s /e /i /y "!SOURCE_DIR!\packages\backend\public\uploads" "!TARGET_DIR!\packages\backend\public\uploads" >nul
        echo         Uploads copies
    )

    :: Copy .env files if they exist
    if exist "!SOURCE_DIR!\packages\backend\.env" (
        copy /y "!SOURCE_DIR!\packages\backend\.env" "!TARGET_DIR!\packages\backend\.env" >nul
        echo         Backend .env copie
    )
    if exist "!SOURCE_DIR!\packages\frontend\.env" (
        copy /y "!SOURCE_DIR!\packages\frontend\.env" "!TARGET_DIR!\packages\frontend\.env" >nul
        echo         Frontend .env copie
    )
) else (
    echo  [6/8] Pas de donnees a copier (installation neuve)
)
echo.

:: -------------------------------------------------------
:: 7. Create .env if missing + database migrations
:: -------------------------------------------------------
echo  [7/8] Configuration + Prisma...

:: Create backend .env if not copied from previous install
if not exist "!TARGET_DIR!\packages\backend\.env" (
    echo DATABASE_URL="file:./dev.db"> "!TARGET_DIR!\packages\backend\.env"
    echo PORT=3001>> "!TARGET_DIR!\packages\backend\.env"
    echo         Backend .env cree
)

cd /d "!TARGET_DIR!\packages\backend"
call npx prisma generate
call npx prisma db push --accept-data-loss 2>nul || call npx prisma migrate deploy 2>nul
echo  OK
echo.

:: -------------------------------------------------------
:: 8. Build frontend
:: -------------------------------------------------------
echo  [8/8] Build du frontend...
cd /d "!TARGET_DIR!"
call npm run build
echo  OK
echo.

:: -------------------------------------------------------
:: Create launcher .bat from template
:: -------------------------------------------------------
cd /d "!TARGET_DIR!"
copy /y "!TARGET_DIR!\RaceHubOS.bat.template" "!TARGET_DIR!\RaceHubOS-v!VERSION!.bat" >nul
powershell -NoProfile -Command "(Get-Content '!TARGET_DIR!\RaceHubOS-v!VERSION!.bat') -replace '__VERSION__','v!VERSION!' -replace '__TARGET_DIR__','!TARGET_DIR!' | Set-Content '!TARGET_DIR!\RaceHubOS-v!VERSION!.bat'"

:: -------------------------------------------------------
:: Create desktop shortcut
:: -------------------------------------------------------
set "SHORTCUT=%USERPROFILE%\Desktop\RaceHubOS v!VERSION!.lnk"
set "ICON=!TARGET_DIR!\logo.ico"
if not exist "!ICON!" set "ICON="

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '!TARGET_DIR!\RaceHubOS-v!VERSION!.bat'; $s.WorkingDirectory = '!TARGET_DIR!'; if ('!ICON!' -ne '') { $s.IconLocation = '!ICON!' }; $s.Save()"
echo  Raccourci bureau cree: RaceHubOS v!VERSION!

echo  ====================================
echo    Upgrade termine !
echo  ====================================
echo.
echo  Version  : v!VERSION!
echo  Dossier  : !TARGET_DIR!
echo  Lanceur  : !TARGET_DIR!\RaceHubOS-v!VERSION!.bat
echo.
echo  Pour lancer: double-cliquer sur RaceHubOS-v!VERSION!.bat
echo  dans le dossier !TARGET_DIR!
echo.
echo  ====================================
echo    Changelog
echo  ====================================
echo.
type "!TARGET_DIR!\CHANGELOG.md"
echo.
pause
