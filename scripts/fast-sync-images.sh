#!/zsh
# fast-sync-images.sh - Sincronizzazione rapida immagini Mac -> NAS Container

set -e

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
CONTAINER_NAME="vinyl-app"
COLLECTION_ID="pbc_1326837967"
LOCAL_STORAGE="dist/storage"
TMP_DIR="tmp_pb_sync"

echo "📂 Preparazione sincronizzazione immagini..."

if [ ! -d "$LOCAL_STORAGE" ]; then
    echo "❌ Errore: Cartella $LOCAL_STORAGE non trovata!"
    exit 1
fi

# Pulisce e crea la struttura
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/storage/$COLLECTION_ID"

# Organizza i file nella struttura PocketBase: storage/COLLECTION_ID/RECORD_ID/FILENAME
echo "📦 Organizzazione file..."
cd "$LOCAL_STORAGE"
for f in *; do
    if [[ "$f" == *-* ]]; then
        RECORD_ID="${f%%-*}"
        FILENAME="${f#*-}"
        mkdir -p "../../$TMP_DIR/storage/$COLLECTION_ID/$RECORD_ID"
        cp "$f" "../../$TMP_DIR/storage/$COLLECTION_ID/$RECORD_ID/$FILENAME"
    fi
done
cd ../..

echo "🚀 Invio al NAS e copia nel container..."
# 1. Impacchettiamo e inviamo al NAS in una cartella temporanea
# 2. Sul NAS, usiamo 'docker cp' per copiare i file nel container
# 3. Puliamo i file temporanei sul NAS
tar -cz -C "$TMP_DIR" . | ssh $NAS_USER@$NAS_IP "
    mkdir -p /tmp/pb_sync_nas
    tar -xz -C /tmp/pb_sync_nas
    sudo docker cp /tmp/pb_sync_nas/storage $CONTAINER_NAME:/pb/pb_data/
    sudo rm -rf /tmp/pb_sync_nas
    echo '✅ File copiati con successo nel container $CONTAINER_NAME'
"

# Pulizia locale
rm -rf "$TMP_DIR"
echo "🏁 Sincronizzazione completata!"
