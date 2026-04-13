#!/bin/zsh
set -e

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"

# Auto-fix: Zsh-native way to find the script's directory and move to project root
cd "${0:A:h}/.."

echo "🚀 1. Avvio deploy lightweight V37.1 da: $(pwd)"
npx vite build --emptyOutDir

echo "🔍 Verifica build V37.1..."
if ! grep -r "V37.1" dist/assets/ > /dev/null 2>&1; then
    echo "❌ ERROR: La build prodotta non contiene la versione V37.1!"
    echo "   Attesa: V37.1-ZENITH nel codice sorgente."
    exit 1
fi
echo "✅ Build verificata."

echo "🧹 2. Tabula Rasa dei metadati Mac (dot_clean + no-xattrs)..."
dot_clean -m . || true
find . -name "._*" -delete || true

echo "🚀 3. Final Bypass Activation... [SERVE PASSWORD UNA SOLA VOLTA]"

# Usiamo un pipe pulito senza -t per evitare conflitti con il tar
tar --no-xattrs -cz --exclude='._*' .env dist/ backend/pb_hooks/ backend/pb_migrations/ src/data/vinyls-static.json | ssh $NAS_USER@$NAS_IP "
    set -e
    export PATH=\$PATH:/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/usr/local/bin
    export DOCKER_CONFIG=\"/share/Public/.docker-config-\$RANDOM\"
    mkdir -p \"\$DOCKER_CONFIG\"
    
    TMP_DIR=\"/share/Public/vinyl-temp-\$RANDOM\"
    mkdir -p \"\$TMP_DIR\"
    cd \"\$TMP_DIR\"
    
    echo '>> Ricezione file (Nuovi Magic Hooks + Import Data)...'
    tar -xzf -
    
    # 🏁 AREA EVASIONE: Spostiamo i dati e i CODICI nel Volume Persistente
    SELECT_VOL=\"/share/Public/vinyl-data-rescue\"
    
    echo \">> Preparazione cartelle sul NAS (\$SELECT_VOL)...\"
    mkdir -p \"\$SELECT_VOL/pb_hooks\" \"\$SELECT_VOL/pb_migrations\" \"\$SELECT_VOL/pb_data\" \"\$SELECT_VOL/pb_public\"
    
    echo \">> Pulizia preventiva Hooks e Frontend sul NAS...\"
    rm -rf \"\$SELECT_VOL/pb_hooks\"/*
    rm -rf \"\$SELECT_VOL/pb_public\"/*
    
    echo \">> Iniezione Codice e Frontend nel Volume (Operazione Verità)...\"
    cp -r backend/pb_hooks/. \"\$SELECT_VOL/pb_hooks/\"
    cp -r backend/pb_migrations/. \"\$SELECT_VOL/pb_migrations/\"
    cp -r dist/. \"\$SELECT_VOL/pb_public/\"
    cp src/data/vinyls-static.json \"\$SELECT_VOL/import.json\"
    
    echo \">> Pulizia profonda metadati MacOS (._*) sul NAS...\"
    find \"\$SELECT_VOL\" -name \"._*\" -delete || true
    
    echo \">> Sincronizzazione permessi (777)...\"
    chmod -R 777 \"\$SELECT_VOL\" || true
    rm -f \"\$SELECT_VOL/pb_data\"/*.db-shm \"\$SELECT_VOL/pb_data\"/*.db-wal \"\$SELECT_VOL/pb_data\"/*.db-lock || true
    
    echo \">> Usiamo Percorso Finale: \$SELECT_VOL\"
    
    # 🕵️ SCOPERTA IMMAGINE (Nome esatto trovato sul NAS)
    TARGET_CONTAINER=\"vinyl-app-deploy-vinyl-app-1\"
    IMAGE_NAME=\"vinyl-app-deploy-vinyl-app:latest\"
    
    echo \">> Usiamo l'Immagine corretta: \$IMAGE_NAME\"
    
    echo \">> Pulizia container esistenti (\$TARGET_CONTAINER)...\"
    docker rm -f \"\$TARGET_CONTAINER\" 2>/dev/null || true
    
    # 🔄 RESTART (TRIPLO PONTE RIPRISTINATO: DATI + HOOKS + MIGRATIONS)
    echo \">> Riavvio container ufficiale (Ripristino Totale)...\"
    ENV_FLAG=\"\"
    [ -f \"\$SELECT_VOL/.env\" ] && ENV_FLAG=\"--env-file \$SELECT_VOL/.env\"
    docker run -d \
        --name vinyl-app-deploy-vinyl-app-1 \
        --restart unless-stopped \
        -p 8090:8090 \
        -v \"\$SELECT_VOL\":/pb/pb_data \
        -v \"\$SELECT_VOL/pb_hooks\":/pb/pb_hooks \
        -v \"\$SELECT_VOL/pb_migrations\":/pb/pb_migrations \
        -v \"\$SELECT_VOL/pb_public\":/pb/pb_public \
        \$ENV_FLAG \
        --workdir /pb \
        --entrypoint ./pocketbase \
        \"\$IMAGE_NAME\" \
        serve --http=0.0.0.0:8090
    
    sleep 5
    NEW_CONTAINER=\"vinyl-app-deploy-vinyl-app-1\"
    
    echo \"🔍 VERIFICA FINALE (VERSIONE CODICE):\"
    docker exec \$NEW_CONTAINER grep \"Definitive Edition\" /pb/pb_hooks/main.pb.js || echo \"ERRORE: Versione non aggiornata!\"
    
    # 🔧 SUPERUSER FORCE
    echo \">> Aggiornamento Admin...\"
    docker exec \$NEW_CONTAINER ./pocketbase superuser upsert frasciarre@gmail.com Q3WLitXAKm5k2VH || true
    
    echo \"================ LOG DEL CONTAINER ================\"
    docker logs --tail 20 \$NEW_CONTAINER
    echo \"===============================================================\"
    
    rm -rf \"\$TMP_DIR\" \"\$DOCKER_CONFIG\"
    echo \"✅ OPERAZIONE COMPLETATA!\"
    echo \"🎉 IL SITO È ONLINE AL LINK: http://$NAS_IP:8090\"
"

echo "🎉 FINITO! Ricarica il browser e goditi i tuoi vinili!"
