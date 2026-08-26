#!/bin/bash
cd "$(dirname "$0")"
echo "🏁 RaceHubOS"
lsof -ti:3001 | xargs kill -9 2>/dev/null

open_when_ready() {
  for _ in $(seq 1 30); do
    sleep 2
    if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
      open "http://localhost:3001" 2>/dev/null || xdg-open "http://localhost:3001" 2>/dev/null
      return
    fi
  done
}

open_when_ready &

while true; do
  npm start
  EXIT_CODE=$?

  # 42 = mise à jour appliquée depuis l'app, on relance
  [ $EXIT_CODE -eq 42 ] && { echo "Redémarrage après mise à jour..."; sleep 2; continue; }
  [ $EXIT_CODE -eq 0 ] && break

  echo
  echo "===================================="
  echo "  RaceHubOS n'a pas démarré"
  echo "===================================="
  if [ $EXIT_CODE -eq 43 ]; then
    echo "  La migration de la base de données a échoué."
    echo "  La base n'a pas été modifiée et une sauvegarde a été créée"
    echo "  dans packages/backend/prisma/db-old/."
  else
    echo "  Erreur au démarrage (code $EXIT_CODE)."
    echo "  Causes possibles : mise à jour incomplète, dépendances manquantes."
  fi
  echo
  echo "  [R] Relancer la mise à jour (réparation)"
  echo "  [D] Réessayer de démarrer"
  echo "  [F] Fermer"
  echo
  read -r -p "  Votre choix [R/D/F] : " choice

  case "$choice" in
    [Rr]*)
      echo "  Réparation en cours, ne fermez pas cette fenêtre..."
      if ! npm run repair; then
        echo "  La réparation a échoué. Relancez l'installeur RaceHubOS."
        read -r -p "  Appuyez sur Entrée pour fermer..."
        break
      fi
      open_when_ready &
      ;;
    [Dd]*) ;;
    *) break ;;
  esac
done
