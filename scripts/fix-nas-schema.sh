#!/zsh
# fix-nas-schema.sh - Aggiunta campi mancanti al database sul NAS

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
MIGRATION_FILE="backend/pb_migrations/20260408000000_add_missing_meta_fields.js"

echo "🔍 Controllo file migrazione..."
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Errore: $MIGRATION_FILE non trovato!"
    exit 1
fi

echo "🚀 Invio migrazione e riavvio container (Inserisci la password 'fraadmin' se richiesto)..."

cat "$MIGRATION_FILE" | ssh $NAS_USER@$NAS_IP "
    sudo tee /tmp/add_fields.js > /dev/null
    sudo docker cp /tmp/add_fields.js vinyl-app:/pb/pb_migrations/
    sudo docker restart vinyl-app
"

echo "✅ FINITO! Il database sul NAS ora ha i campi necessari."
echo "Ora chiedi all'IA di completare il ripristino dei dati."
