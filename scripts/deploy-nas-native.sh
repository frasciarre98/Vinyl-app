#!/bin/zsh
set -e

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
TARGET_DIR="/share/Web/vinyl-app-build"

echo "📦 1. Prendo i file del progetto e li preparo (ignorando file pesanti inutili)..."

# Check if target dir exists on NAS, if not create it
ssh $NAS_USER@$NAS_IP "mkdir -p $TARGET_DIR"

# Pulire eventuale spazzatura rimasta sul server dal colpo fallito precedente
ssh $NAS_USER@$NAS_IP "rm -rf $TARGET_DIR/*"

# Tar the project (excluding node_modules, .git, dist, and zip files) and send it directly over SSH
echo "🚀 2. Invio i dati al NAS (Ti verra chiesta la password per l invio)..."
tar -czf - --exclude="node_modules" --exclude=".git" --exclude="dist" --exclude="*.zip" --exclude="public/storage" --exclude=".gemini" . | ssh $NAS_USER@$NAS_IP "tar -xzf - -C $TARGET_DIR"

echo "⚙️  3. Costruisco e avvio l app direttamente sul NAS (Ti verra chiesta la password per il riavvio)..."
ssh $NAS_USER@$NAS_IP "cd $TARGET_DIR && \
  sudo docker build -t vinyl-catalog-app . && \
  sudo docker stop vinyl-app || true && \
  sudo docker rm vinyl-app || true && \
  sudo docker run -d -p 5173:5173 --name vinyl-app --restart unless-stopped vinyl-catalog-app && \
  echo \"✅ BOOM! Tutto finito e aggiornatissimo!\""

