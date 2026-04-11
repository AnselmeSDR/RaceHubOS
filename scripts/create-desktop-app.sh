#!/bin/bash
# Creates the desktop .app bundle (macOS) or shortcut (Windows)
# Called by RaceHubOS-upgrade.command after install
# Usage: bash scripts/create-desktop-app.sh <TARGET_DIR> <VERSION>

TARGET_DIR="$1"
VERSION="$2"

if [ -z "$TARGET_DIR" ] || [ -z "$VERSION" ]; then
    echo "Usage: $0 <TARGET_DIR> <VERSION>"
    exit 1
fi

APP_DIR="$HOME/Desktop/RaceHubOS v$VERSION.app"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Create executable
cat > "$APP_DIR/Contents/MacOS/RaceHubOS" << EXEC_EOF
#!/bin/bash
cd "$TARGET_DIR"
osascript -e 'tell application "Terminal" to do script "cd \"$TARGET_DIR\" && npm start"'
sleep 3
open "http://localhost:3001"
EXEC_EOF
chmod +x "$APP_DIR/Contents/MacOS/RaceHubOS"

# Create Info.plist
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

# Convert logo.png to icns
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

# Force macOS to register the app and load its icon
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP_DIR" 2>/dev/null
touch "$APP_DIR"

echo "  App bureau créée: RaceHubOS v$VERSION.app"
