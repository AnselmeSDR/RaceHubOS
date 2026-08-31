#!/bin/bash
# INSTALLER_VERSION 2
# À incrémenter à CHAQUE modification de ce fichier : c'est ce numéro, et non le
# contenu, qui déclenche la mise à jour automatique ci-dessous.
set -e

echo ""
echo "  ===================================="
echo "    RaceHubOS - Upgrade (macOS/Linux)"
echo "  ===================================="
echo ""

# -------------------------------------------------------
# 0. Mettre à jour cet installeur avant qu'il agisse
#
# Ce fichier est une copie figée sur le bureau et rien ne le rafraîchit. Un
# installeur périmé fait des choses périmées : celui du PC de course, daté du
# 15/04, recopiait tout le dossier prisma de l'ancienne installation par-dessus
# la nouvelle, ce qui a mis un schema.prisma refusé par Prisma 7 dans un dossier
# v1.18.0 tout neuf et empêché l'application de démarrer.
#
# Le remplacement et le relancement tiennent sur une seule ligne : bash lit une
# ligne en entier avant de l'exécuter, et exec remplace le processus, donc rien
# n'est relu dans le fichier qu'on vient d'écraser.
# -------------------------------------------------------
SELF_URL="https://raw.githubusercontent.com/AnselmeSDR/RaceHubOS/main/RaceHubOS-install-mac.command"
SELF_NEW="$(mktemp -t racehubos-install)"
installerVersion() { grep -m1 '^# INSTALLER_VERSION' "$1" 2>/dev/null | awk '{print $3}'; }

if [ "$1" != "--updated" ]; then
    echo "  [0/8] Vérification de l'installeur..."
    if curl -fsSL --max-time 20 "$SELF_URL" -o "$SELF_NEW" 2>/dev/null; then
        LOCAL_IV=$(installerVersion "$0"); LOCAL_IV=${LOCAL_IV:-0}
        REMOTE_IV=$(installerVersion "$SELF_NEW"); REMOTE_IV=${REMOTE_IV:-0}

        if [ "$REMOTE_IV" -gt "$LOCAL_IV" ] 2>/dev/null; then
            echo "         Installeur $LOCAL_IV remplacé par la version $REMOTE_IV, relancement..."
            cp "$SELF_NEW" "$0" && chmod +x "$0" && rm -f "$SELF_NEW" && exec "$0" --updated
        fi
        echo "         À jour (version $LOCAL_IV)"
    else
        echo "         Vérification impossible, poursuite avec cet installeur"
    fi
    rm -f "$SELF_NEW"
    echo ""
fi

# -------------------------------------------------------
# 0. Check prerequisites
# -------------------------------------------------------
echo "  [0/7] Vérification des prérequis..."

# Check/install Homebrew (macOS only)
if [[ "$OSTYPE" == "darwin"* ]] && ! command -v brew &>/dev/null; then
    echo "  Homebrew non trouvé. Installation..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo "  Homebrew installé. Relancez ce script."
    exit 0
fi

# Check/install Git
if ! command -v git &>/dev/null; then
    echo "  Git non trouvé. Installation..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install git
    else
        sudo apt-get update && sudo apt-get install -y git
    fi
fi

# Check/install Node.js
if ! command -v node &>/dev/null; then
    echo "  Node.js non trouvé. Installation..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install node@22
    else
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    echo "  Node.js installé. Relancez ce script."
    exit 0
fi

# Check Node version (22+)
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "  ATTENTION: Node.js v$NODE_MAJOR détecté, v22+ requis."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install node@22
    else
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    echo "  Node.js mis à jour. Relancez ce script."
    exit 0
fi

echo "  $(node -v) OK"
echo "  $(git --version) OK"
echo ""

# -------------------------------------------------------
# 1. Stop running processes
# -------------------------------------------------------
echo "  [1/8] Arrêt des processus en cours..."
pkill -f "node.*racehubos" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
echo "  OK"
echo ""

# -------------------------------------------------------
# 2. Find source directory (latest version with data)
# -------------------------------------------------------
INSTALL_DIR="$HOME"
SOURCE_DIR=""

for dir in $(ls -d "$INSTALL_DIR"/RaceHubOS-v* 2>/dev/null | sort -t. -k1,1n -k2,2n -k3,3n | tac); do
    if [ -f "$dir/packages/backend/prisma/dev.db" ]; then
        SOURCE_DIR="$dir"
        break
    fi
done

if [ -n "$SOURCE_DIR" ]; then
    echo "  [2/8] Source trouvée: $SOURCE_DIR"
else
    echo "  [2/8] Aucune version précédente trouvée (installation neuve)"
fi
echo ""

# -------------------------------------------------------
# 3. Clone the repo
# -------------------------------------------------------
REPO_URL="https://github.com/AnselmeSDR/RaceHubOS.git"
TEMP_DIR="$INSTALL_DIR/RaceHubOS-temp"

echo "  [3/8] Téléchargement de la dernière version..."
rm -rf "$TEMP_DIR"
git clone --depth 1 "$REPO_URL" "$TEMP_DIR"
echo "  OK"
echo ""

# -------------------------------------------------------
# 4. Read version
# -------------------------------------------------------
VERSION=$(grep '"version"' "$TEMP_DIR/package.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')

if [ -z "$VERSION" ]; then
    echo "  ERREUR: Impossible de lire la version"
    exit 1
fi

TARGET_DIR="$INSTALL_DIR/RaceHubOS-v$VERSION"
echo "  [4/8] Version détectée: v$VERSION"
echo "         Destination: $TARGET_DIR"

if [ -d "$TARGET_DIR" ]; then
    echo ""
    read -p "  Le dossier existe déjà. Écraser ? (O/N) : " OVERWRITE
    if [[ ! "$OVERWRITE" =~ ^[Oo]$ ]]; then
        echo "  Annulé."
        rm -rf "$TEMP_DIR"
        exit 0
    fi
    rm -rf "$TARGET_DIR"
fi

mv "$TEMP_DIR" "$TARGET_DIR"
echo "  OK"

echo ""

# -------------------------------------------------------
# 5. Install dependencies
# -------------------------------------------------------
echo "  [5/8] Installation des dépendances (npm install)..."
cd "$TARGET_DIR"
npm install --legacy-peer-deps
echo "  OK"
echo ""

# -------------------------------------------------------
# 6. Copy data from source
# -------------------------------------------------------
if [ -n "$SOURCE_DIR" ]; then
    echo "  [6/8] Copie des données depuis $SOURCE_DIR..."

    if [ -f "$SOURCE_DIR/packages/backend/prisma/dev.db" ]; then
        cp "$SOURCE_DIR/packages/backend/prisma/dev.db" "$TARGET_DIR/packages/backend/prisma/dev.db"
        echo "         Base de données copiée"
    fi

    if [ -d "$SOURCE_DIR/packages/backend/public/uploads" ]; then
        cp -r "$SOURCE_DIR/packages/backend/public/uploads" "$TARGET_DIR/packages/backend/public/uploads"
        echo "         Uploads copiés"
    fi

    [ -f "$SOURCE_DIR/packages/backend/.env" ] && cp "$SOURCE_DIR/packages/backend/.env" "$TARGET_DIR/packages/backend/.env" && echo "         Backend .env copié"
    [ -f "$SOURCE_DIR/packages/frontend/.env" ] && cp "$SOURCE_DIR/packages/frontend/.env" "$TARGET_DIR/packages/frontend/.env" && echo "         Frontend .env copié"
else
    echo "  [6/8] Pas de données à copier (installation neuve)"
fi
echo ""

# -------------------------------------------------------
# 7. Create .env if missing + database migrations
# -------------------------------------------------------
echo "  [7/8] Configuration + Prisma..."

# Create backend .env if not copied from previous install
if [ ! -f "$TARGET_DIR/packages/backend/.env" ]; then
    cat > "$TARGET_DIR/packages/backend/.env" << 'ENV_EOF'
DATABASE_URL="file:./dev.db"
PORT=3001
ENV_EOF
    echo "         Backend .env créé"
fi

cd "$TARGET_DIR/packages/backend"
npx prisma generate
# Dated backup in prisma/db-old/ before touching the schema
node scripts/backup-db.js install || true
# Applique les migrations, en baselinant une base antérieure aux migrations
node scripts/migrate.js || true
echo "  OK"
echo ""

# -------------------------------------------------------
# 8. Build frontend
# -------------------------------------------------------
echo "  [8/8] Build du frontend..."
cd "$TARGET_DIR"
npm run build
echo "  OK"
echo ""

# -------------------------------------------------------
# Create launcher script
# -------------------------------------------------------
LAUNCHER="$TARGET_DIR/RaceHubOS.command"
cat > "$LAUNCHER" << 'LAUNCHER_EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "🏁 RaceHubOS"
sleep 2 && (open "http://localhost:3001" 2>/dev/null || xdg-open "http://localhost:3001" 2>/dev/null) &
while true; do
  npm start
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 42 ]; then break; fi
  echo "Redémarrage après mise à jour..."
  sleep 2
done
LAUNCHER_EOF
chmod +x "$LAUNCHER"

# -------------------------------------------------------
# Create desktop .app with icon
# -------------------------------------------------------
APP_DIR="$HOME/Desktop/RaceHubOS.app"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cat > "$APP_DIR/Contents/MacOS/RaceHubOS" << EXEC_EOF
#!/bin/bash
open "$TARGET_DIR/RaceHubOS.command"
EXEC_EOF
chmod +x "$APP_DIR/Contents/MacOS/RaceHubOS"

cat > "$APP_DIR/Contents/Info.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>RaceHubOS</string>
    <key>CFBundleDisplayName</key>
    <string>RaceHubOS v$VERSION</string>
    <key>CFBundleIdentifier</key>
    <string>com.racehubos.app</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleExecutable</key>
    <string>RaceHubOS</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>
PLIST_EOF

LOGO_PNG="$TARGET_DIR/packages/frontend/public/logo.png"
if [ -f "$LOGO_PNG" ]; then
    ICONSET="$APP_DIR/Contents/Resources/icon.iconset"
    mkdir -p "$ICONSET"
    sips -z 16 16     "$LOGO_PNG" --out "$ICONSET/icon_16x16.png" >/dev/null 2>&1
    sips -z 32 32     "$LOGO_PNG" --out "$ICONSET/icon_16x16@2x.png" >/dev/null 2>&1
    sips -z 32 32     "$LOGO_PNG" --out "$ICONSET/icon_32x32.png" >/dev/null 2>&1
    sips -z 64 64     "$LOGO_PNG" --out "$ICONSET/icon_32x32@2x.png" >/dev/null 2>&1
    sips -z 128 128   "$LOGO_PNG" --out "$ICONSET/icon_128x128.png" >/dev/null 2>&1
    sips -z 256 256   "$LOGO_PNG" --out "$ICONSET/icon_128x128@2x.png" >/dev/null 2>&1
    sips -z 256 256   "$LOGO_PNG" --out "$ICONSET/icon_256x256.png" >/dev/null 2>&1
    sips -z 512 512   "$LOGO_PNG" --out "$ICONSET/icon_256x256@2x.png" >/dev/null 2>&1
    sips -z 512 512   "$LOGO_PNG" --out "$ICONSET/icon_512x512.png" >/dev/null 2>&1
    sips -z 1024 1024 "$LOGO_PNG" --out "$ICONSET/icon_512x512@2x.png" >/dev/null 2>&1
    iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/icon.icns" 2>/dev/null
    rm -rf "$ICONSET"
fi

/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP_DIR" 2>/dev/null
touch "$APP_DIR"
echo "  App bureau créée: RaceHubOS v$VERSION.app"
echo ""

echo "  ===================================="
echo "    Upgrade terminé !"
echo "  ===================================="
echo ""
echo "  Version  : v$VERSION"
echo "  Dossier  : $TARGET_DIR"
echo "  Lanceur  : $LAUNCHER"
echo ""
echo "  Pour lancer: double-cliquer sur RaceHubOS.command dans $TARGET_DIR"
echo ""
echo "  ===================================="
echo "    Changelog"
echo "  ===================================="
echo ""
cat "$TARGET_DIR/CHANGELOG.md"
echo ""
