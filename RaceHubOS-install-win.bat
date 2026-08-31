@echo off
:: INSTALLER_VERSION 2
:: A incrementer a CHAQUE modification de ce fichier : c'est ce numero, et non le
:: contenu, qui declenche la mise a jour automatique ci-dessous. Comparer les
:: contenus ne marcherait pas -- Git for Windows convertit les fins de ligne au
:: clone, donc le fichier du bureau ne sera jamais identique a celui de GitHub.
setlocal enabledelayedexpansion
title RaceHubOS - Upgrade
cd /d "%USERPROFILE%"

echo.
echo  ====================================
echo    RaceHubOS - Upgrade
echo  ====================================
echo.

:: -------------------------------------------------------
:: 0. Mettre a jour cet installeur avant qu'il agisse
::
:: Ce fichier est une copie figee sur le bureau et rien ne le rafraichit. Un
:: installeur perime fait des choses perimees : celui du PC de course, date du
:: 15/04, recopiait tout le dossier prisma de l'ancienne installation par-dessus
:: la nouvelle, ce qui a mis un schema.prisma refuse par Prisma 7 dans un dossier
:: v1.18.0 tout neuf et empeche l'application de demarrer.
::
:: Le remplacement et le relancement tiennent sur une seule ligne : cmd lit une
:: ligne en entier avant de l'executer, donc rien n'est relu dans le fichier
:: qu'on vient d'ecraser. L'argument --updated coupe la boucle.
:: -------------------------------------------------------
set "SELF_URL=https://raw.githubusercontent.com/AnselmeSDR/RaceHubOS/main/RaceHubOS-install-win.bat"
set "SELF_NEW=%TEMP%\RaceHubOS-install-win-latest.bat"

if /i not "%~1"=="--updated" (
    echo  [0/8] Verification de l'installeur...
    REM Un telechargement rate laisserait sinon croire au fichier de la fois d'avant
    if exist "!SELF_NEW!" del /f /q "!SELF_NEW!" >nul 2>&1
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '!SELF_URL!' -OutFile '!SELF_NEW!' -UseBasicParsing -TimeoutSec 20 } catch { exit 1 }" >nul 2>&1

    if exist "!SELF_NEW!" (
        set "LOCAL_IV=0"
        set "REMOTE_IV=0"
        for /f "tokens=3" %%v in ('findstr /b /c:":: INSTALLER_VERSION" "%~f0"') do set "LOCAL_IV=%%v"
        for /f "tokens=3" %%v in ('findstr /b /c:":: INSTALLER_VERSION" "!SELF_NEW!"') do set "REMOTE_IV=%%v"

        if !REMOTE_IV! GTR !LOCAL_IV! ( echo         Installeur !LOCAL_IV! remplace par la version !REMOTE_IV!, relancement... & copy /y "!SELF_NEW!" "%~f0" >nul & start "" "%~f0" --updated & exit )

        echo         A jour ^(version !LOCAL_IV!^)
    ) else (
        echo         Verification impossible, poursuite avec cet installeur
    )
    echo.
)

:: -------------------------------------------------------
:: 0b. Check Node.js and Git
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

:: Check minimum version (Node 22+)
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODE_MAJOR=%%v"
if !NODE_MAJOR! LSS 22 (
    echo  ATTENTION: Node.js v!NODE_MAJOR! detecte, v22+ requis.
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

    REM Copy database
    if exist "!SOURCE_DIR!\packages\backend\prisma\dev.db" (
        copy /y "!SOURCE_DIR!\packages\backend\prisma\dev.db" "!TARGET_DIR!\packages\backend\prisma\dev.db" >nul
        echo         Base de donnees copiee
    )

    REM Copy uploads
    if exist "!SOURCE_DIR!\packages\backend\public\uploads" (
        xcopy /s /e /i /y "!SOURCE_DIR!\packages\backend\public\uploads" "!TARGET_DIR!\packages\backend\public\uploads" >nul
        echo         Uploads copies
    )

    REM Copy .env files if they exist
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
:: Dated backup in prisma\db-old\ before touching the schema
call node scripts\backup-db.js install
:: Applique les migrations, en baselinant une base anterieure aux migrations
call node scripts\migrate.js
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
