#!/bin/bash
set -e

echo ""
echo "  ===================================="
echo "    RaceHubOS - Upgrade (macOS/Linux)"
echo "  ===================================="
echo ""

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
        brew install node@20
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    echo "  Node.js installé. Relancez ce script."
    exit 0
fi

# Check Node version (20+)
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "  ATTENTION: Node.js v$NODE_MAJOR détecté, v20+ requis."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install node@20
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
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
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma migrate deploy 2>/dev/null || true
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
echo "Démarrage de RaceHubOS..."
npm start &
sleep 3
open "http://localhost:3001" 2>/dev/null || xdg-open "http://localhost:3001" 2>/dev/null
wait
LAUNCHER_EOF
chmod +x "$LAUNCHER"

# -------------------------------------------------------
# Create desktop app (always from new version's script)
# -------------------------------------------------------
if [ -f "$TARGET_DIR/scripts/create-desktop-app.sh" ]; then
    bash "$TARGET_DIR/scripts/create-desktop-app.sh" "$TARGET_DIR" "$VERSION"
fi
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
