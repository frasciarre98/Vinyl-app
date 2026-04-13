#!/bin/zsh
# Zsh absolute path detection
cd "${0:A:h}/.."

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
SELECT_VOL="/share/Public/vinyl-data-rescue"
IMAGE_NAME="vinyl-app-deploy-vinyl-app:latest"

echo "⚡ AVVIO REPAIR SQL FISICO (V33.25)..."
echo "⚠️  Inserisci la password quando richiesto ($NAS_USER)."

# Comando compattato senza query in-line (massima stabilità)
REMOTE_CMD="export PATH=\$PATH:/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/usr/local/bin; "
REMOTE_CMD+="sudo killall -9 sqlite3 pocketbase 2>/dev/null || true; "
REMOTE_CMD+="docker rm -f vinyl-app-deploy-vinyl-app-1 2>/dev/null || true; "
REMOTE_CMD+="sudo rm -f $SELECT_VOL/pb_data/*.db-shm $SELECT_VOL/pb_data/*.db-wal $SELECT_VOL/pb_data/*.db-lock || true; "
REMOTE_CMD+="sudo chown -R $NAS_USER $SELECT_VOL; "

echo ">> 1/3: Infiltrazione e riparazione via file fisico..."
REMOTE_CMD+="docker run --rm -v $SELECT_VOL:/data alpine sh -c 'apk add --no-cache sqlite && sqlite3 /data/pb_data/data.db < /data/pb_hooks/repair.sql'; "

REMOTE_CMD+="echo '>> Riavvio server...'; "
REMOTE_CMD+="ENV_ARG=''; [ -f '$SELECT_VOL/.env' ] && ENV_ARG='--env-file $SELECT_VOL/.env'; "
REMOTE_CMD+="docker run -d --name vinyl-app-deploy-vinyl-app-1 --restart unless-stopped -p 8090:8090 -v '$SELECT_VOL':/pb/pb_data -v '$SELECT_VOL/pb_hooks':/pb/pb_hooks -v '$SELECT_VOL/pb_migrations':/pb/pb_migrations -v '$SELECT_VOL/pb_public':/pb/pb_public \$ENV_ARG --workdir /pb --entrypoint ./pocketbase '$IMAGE_NAME' serve --http=0.0.0.0:8090; "
REMOTE_CMD+="echo '✅ RIPARAZIONE COMPLETATA!'"

ssh -o ServerAliveInterval=15 -t $NAS_USER@$NAS_IP "$REMOTE_CMD"

echo "\n✨ Procedura terminata. Ora ricarica il sito."
echo "🔗 http://$NAS_IP:8090"
