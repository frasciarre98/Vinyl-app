#!/bin/zsh
set -e

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
TARGET_DIR="/share/Web/vinyl-app-build"

echo "🧹 1. Pulizia profonda del NAS in corso (file residui e vecchie immagini Docker)..."
echo "(Ti verrà chiesta la password del NAS per autorizzare la pulizia)"

# Rimuove l'intera cartella (inclusi i file nascosti) per fare spazio
ssh $NAS_USER@$NAS_IP "rm -rf $TARGET_DIR && mkdir -p $TARGET_DIR"

# Tar the project (excluding node_modules, .git, dist, and zip files) and send it directly over SSH
echo "🚀 2. Invio i dati al NAS (Ti verra chiesta la password per l invio)..."
tar -czf - --exclude="node_modules" --exclude=".git" --exclude="dist" --exclude="*.zip" --exclude="public/storage" --exclude=".gemini" --exclude="tmp_pb_sync" --exclude=".vercel" . | ssh $NAS_USER@$NAS_IP "tar -xzf - -C $TARGET_DIR"

echo "⚙️  3. Costruisco e avvio l app direttamente sul NAS (Ti verra chiesta la password per il riavvio)..."
ssh $NAS_USER@$NAS_IP "cd $TARGET_DIR && \
  sudo docker build -t vinyl-catalog-app . && \
  sudo docker stop vinyl-app || true && \
  sudo docker rm vinyl-app || true && \
  sudo docker run -d -p 5173:5173 --name vinyl-app --restart unless-stopped vinyl-catalog-app && \
  echo \"✅ BOOM! Tutto finito e aggiornatissimo!\""

