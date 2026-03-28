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
:: 1. Stop running processes
:: -------------------------------------------------------
echo  [1/7] Arret des processus en cours...
taskkill /F /IM node.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo  OK
echo.

:: -------------------------------------------------------
:: 2. Find the source directory (latest version with data)
:: -------------------------------------------------------
set "SOURCE_DIR="

:: Check RaceHubOS-v* directories (newest first by name)
for /f "delims=" %%d in ('dir /b /ad /o-n "%USERPROFILE%\RaceHubOS-v*" 2^>nul') do (
    if exist "%USERPROFILE%\%%d\packages\backend\prisma\dev.db" (
        if not defined SOURCE_DIR set "SOURCE_DIR=%USERPROFILE%\%%d"
    )
)

:: Fallback to original RaceHubOS
if not defined SOURCE_DIR (
    if exist "%USERPROFILE%\RaceHubOS\packages\backend\prisma\dev.db" (
        set "SOURCE_DIR=%USERPROFILE%\RaceHubOS"
    )
)

if defined SOURCE_DIR (
    echo  [2/7] Source trouvee: !SOURCE_DIR!
) else (
    echo  [2/7] Aucune version precedente trouvee (installation neuve)
)
echo.

:: -------------------------------------------------------
:: 3. Clone the repo
:: -------------------------------------------------------
set "REPO_URL=https://gitlab.com/AnselmeSDR/RaceHubOS.git"
set "TEMP_DIR=%USERPROFILE%\RaceHubOS-temp"

echo  [3/7] Telechargement de la derniere version...
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
echo  [4/7] Version detectee: v!VERSION!
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
echo  [5/7] Installation des dependances (npm install)...
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
    echo  [6/7] Copie des donnees depuis !SOURCE_DIR!...

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
    echo  [6/7] Pas de donnees a copier (installation neuve)
)
echo.

:: -------------------------------------------------------
:: 7. Run database migrations
:: -------------------------------------------------------
echo  [7/7] Migration de la base de donnees...
cd /d "!TARGET_DIR!\packages\backend"
call npx prisma db push --accept-data-loss 2>nul || call npx prisma migrate deploy 2>nul
echo  OK
echo.

:: -------------------------------------------------------
:: Create launcher .bat
:: -------------------------------------------------------
cd /d "!TARGET_DIR!"

(
echo @echo off
echo title RaceHubOS v!VERSION!
echo cd /d "!TARGET_DIR!"
echo echo.
echo echo  ====================================
echo echo    RaceHubOS v!VERSION! - Starting...
echo echo  ====================================
echo echo.
echo echo  Checking ports...
echo for /f "tokens=5" %%%%a in ^('netstat -aon ^^^| findstr :3001 ^^^| findstr LISTENING'^) do taskkill /F /PID %%%%a ^>nul 2^>^&1
echo for /f "tokens=5" %%%%a in ^('netstat -aon ^^^| findstr :5173 ^^^| findstr LISTENING'^) do taskkill /F /PID %%%%a ^>nul 2^>^&1
echo echo  Ports cleared.
echo echo.
echo echo  Frontend: http://localhost:5173
echo echo  Backend:  http://localhost:3001
echo echo.
echo echo  Fermer cette fenetre pour arreter.
echo echo.
echo start /b cmd /c "timeout /t 5 /nobreak ^>nul ^&^& start http://localhost:5173"
echo npm run dev
) > "!TARGET_DIR!\RaceHubOS-v!VERSION!.bat"

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
pause
