#!/bin/zsh
# Zsh absolute path detection
cd "${0:A:h}/.."

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
SELECT_VOL="/share/Public/vinyl-data-rescue"
IMAGE_NAME="vinyl-app-deploy-vinyl-app:latest"

echo "🔌 AVVIO RIAVVIO DI EMERGENZA (V33.10)..."
echo "⚠️  Ti verrà chiesta la password ($NAS_USER) per il comando Docker."

ssh -t $NAS_USER@$NAS_IP "
    export PATH=\$PATH:/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/usr/local/bin
    
    echo '>> 1/4: TERMINAZIONE FORZATA PORTA 8090 (Nuclear Mode)...'
    sudo fuser -k 8090/tcp 2>/dev/null || true
    
    echo '>> 2/4: Pulizia forzata container bloccati...'
    docker rm -f vinyl-app-deploy-vinyl-app-1 2>/dev/null || true
    
    echo '>> 3/4: Rimozione file di blocco residui (sudo)...'
    sudo rm -f $SELECT_VOL/pb_data/*.db-shm $SELECT_VOL/pb_data/*.db-wal $SELECT_VOL/pb_data/*.db-lock || true
    
    echo '>> 4/4: Riavvio ufficiale del server...'
    docker run -d \
        --name vinyl-app-deploy-vinyl-app-1 \
        --restart unless-stopped \
        -p 8090:8090 \
        -v \"$SELECT_VOL\":/pb/pb_data \
        -v \"$SELECT_VOL/pb_hooks\":/pb/pb_hooks \
        -v \"$SELECT_VOL/pb_migrations\":/pb/pb_migrations \
        -v \"$SELECT_VOL/pb_public\":/pb/pb_public \
        --env-file \"$SELECT_VOL/.env\" \
        --workdir /pb \
        --entrypoint ./pocketbase \
        \"$IMAGE_NAME\" \
        serve --http=0.0.0.0:8090
    
    echo '✅ SERVER RIACCESO CON SUCCESSO!'
"

echo "\n✨ Procedura completata. Attendi 10 secondi e ricarica il sito."
echo "🔗 http://$NAS_IP:8090"
