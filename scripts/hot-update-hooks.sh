#!/bin/zsh
# hot-update-hooks.sh - Invia solo il file main.pb.js al NAS senza ricostruire nulla (bypassando problemi di spazio)

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
HOOKS_FILE="backend/pb_hooks/main.pb.js"

echo "🚀 Invio del nuovo codice di automazione al NAS in modo chirurgico..."
cat "$HOOKS_FILE" | ssh $NAS_USER@$NAS_IP "
    sudo tee /tmp/main.pb.js > /dev/null
    sudo docker cp /tmp/main.pb.js vinyl-app:/pb/pb_hooks/
    echo '🔄 Riavvio del container...'
    sudo docker restart vinyl-app
"

echo "✅ Fatto! Il database ora ha le automazioni per Vercel attive!"
