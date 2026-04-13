#!/bin/zsh
source ~/.zshrc 2>/dev/null
set -e

echo "📦 1. Costruisco una nuova versione dell app..."
docker build -t vinyl-catalog-app .

echo "🚀 2. Invio l aggiornamento al NAS (Ti verra richiesta la password del NAS)..."
docker save vinyl-catalog-app | ssh fraadmin@192.168.0.250 "sudo docker load"

echo "🔄 3. Riavvio l app sul NAS con la nuova versione (Ti verra richiesta di nuovo)..."
ssh fraadmin@192.168.0.250 "sudo docker stop vinyl-app || true && sudo docker rm vinyl-app || true && sudo docker run -d -p 5173:5173 --name vinyl-app --restart unless-stopped vinyl-catalog-app"

echo "✅ FINITO! L app sul NAS e ora aggiornata."

