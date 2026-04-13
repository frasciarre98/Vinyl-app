#!/bin/zsh
# Zsh absolute path detection
cd "${0:A:h}/.."

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
SELECT_VOL="/share/Public/vinyl-data-rescue"

echo "💣 AVVIO OPERAZIONE ULTIMO SALVATAGGIO (V33.8)..."
echo "⚠️  Ti verrà chiesta la password ($NAS_USER) per lo sblocco forzato."

# 1. SSH per terminare processi e pulire Lock
ssh -t $NAS_USER@$NAS_IP "
    echo '>> 1/3: Terminazione forzata processi SQLite e PocketBase...'
    sudo killall -9 sqlite3 2>/dev/null || true
    sudo killall -9 pocketbase 2>/dev/null || true
    
    echo '>> 2/3: Rimozione fisica file di blocco (-shm, -wal)...'
    sudo rm -f $SELECT_VOL/pb_data/*.db-shm
    sudo rm -f $SELECT_VOL/pb_data/*.db-wal
    sudo rm -f $SELECT_VOL/pb_data/*.db-lock
    
    echo '>> 3/3: Ripristino finale permessi cartella...'
    sudo chown -R $NAS_USER:everyone $SELECT_VOL
    sudo chmod -R 777 $SELECT_VOL
    
    echo '✅ NAS SBLOCCATO E PULITO!'
"

echo "\n🚀 Ora lancio il Deploy Finale (V33.7.1)..."
./scripts/deploy-lightweight.sh

echo "\n✨ OPERAZIONE COMPLETATA!"
echo "L'auto-riparatore all'avvio dovrebbe aver già sistemato Led Zeppelin."
echo "Ricarica il sito e controlla la magia: http://$NAS_IP:8090"
