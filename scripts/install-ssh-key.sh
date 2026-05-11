#!/bin/zsh
# Installa la chiave SSH sul NAS usando Docker (aggira il problema home dir mancante)
NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
PUBKEY_FILE="$HOME/.ssh/vinyl_nas.pub"

if [ ! -f "$PUBKEY_FILE" ]; then
    echo "❌ Chiave pubblica non trovata: $PUBKEY_FILE"
    echo "   Rigenera con: ssh-keygen -t ed25519 -f ~/.ssh/vinyl_nas -N ''"
    exit 1
fi

PUBKEY=$(cat "$PUBKEY_FILE")
echo "🔑 Installazione chiave su $NAS_USER@$NAS_IP..."

ssh "$NAS_USER@$NAS_IP" "
    export PATH=\$PATH:/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/usr/local/bin
    docker run --rm -v /:/host alpine sh -c \"
        mkdir -p /host/share/homes/fraadmin/.ssh && \
        chmod 700 /host/share/homes/fraadmin/.ssh && \
        echo '$PUBKEY' >> /host/share/homes/fraadmin/.ssh/authorized_keys && \
        chmod 600 /host/share/homes/fraadmin/.ssh/authorized_keys && \
        chown -R 1000:100 /host/share/homes/fraadmin && \
        echo 'OK'
    \"
" || { echo "❌ Errore durante installazione chiave!"; exit 1; }

echo "✅ Chiave installata! Test connessione..."
ssh -i "$HOME/.ssh/vinyl_nas" -o BatchMode=yes "$NAS_USER@$NAS_IP" "echo '🎉 Accesso senza password funzionante!'"
