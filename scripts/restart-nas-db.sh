#!/bin/zsh
# restart-nas-db.sh - Invia l'ultima migrazione e riavvia il database sul NAS

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
MIGRATION_FILE="backend/pb_migrations/20260515000000_temp_public_rules.js"

echo "🔍 Verifico file migrazione..."
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Errore: $MIGRATION_FILE non trovato!"
    exit 1
fi

echo "🚀 Invio permessi aggiornati al NAS..."
cat "$MIGRATION_FILE" | ssh $NAS_USER@$NAS_IP "
    sudo tee /tmp/temp_rules.js > /dev/null
    sudo docker cp /tmp/temp_rules.js vinyl-app:/pb/pb_migrations/
    echo '🔄 Riavvio container...'
    sudo docker restart vinyl-app
"

echo "✅ Database riavviato e permessi sbloccati!"
