#!/bin/zsh
NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
SELECT_VOL="/share/Public/vinyl-data-rescue"

echo "🔓 Richiedo lo sblocco dei permessi sul NAS ($NAS_IP)..."
echo "⚠️  Ti verrà chiesta la password di $NAS_USER due volte (una per SSH, una per SUDO)."

ssh -t $NAS_USER@$NAS_IP "
    echo '>> Ripristino proprietario (chown)...'
    sudo chown -R $NAS_USER $SELECT_VOL
    
    echo '>> Ripristino gruppo (chgrp)...'
    sudo chgrp -R everyone $SELECT_VOL || true
    
    echo '>> Apertura totale permessi (chmod 777)...'
    sudo chmod -R 777 $SELECT_VOL
    
    echo '>> Pulizia definitiva file di blocco...'
    sudo rm -f $SELECT_VOL/pb_data/*.db-shm $SELECT_VOL/pb_data/*.db-wal $SELECT_VOL/pb_data/*.db-lock
    
    echo '✅ NAS SBLOCCATO CON SUCCESSO!'
"
