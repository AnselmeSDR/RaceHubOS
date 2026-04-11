#!/bin/bash
cd "$(dirname "$0")"
echo "🏁 RaceHubOS"
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2 && (open "http://localhost:3001" 2>/dev/null || xdg-open "http://localhost:3001" 2>/dev/null) &
while true; do
  npm start
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 42 ]; then break; fi
  echo "Redémarrage après mise à jour..."
  sleep 2
done
