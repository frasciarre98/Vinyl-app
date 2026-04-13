#!/bin/zsh
set -e

NAS_USER="fraadmin"
NAS_IP="192.168.0.250"
COLLECTION_ID="pbc_1326837967"
LOCAL_DIR="dist/storage"
REMOTE_DATA_DIR="/share/Public/vinyl-data-rescue"

if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Errore: Cartella $LOCAL_DIR non trovata!"
    exit 1
fi

echo "🖼️ Sincronizzazione Immagini (900+ file)..."

# Creiamo un archivio temporaneo strutturato sul Mac per evitare loop SSH
TMP_SYNC_DIR="tmp_image_sync"
rm -rf "$TMP_SYNC_DIR"
mkdir -p "$TMP_SYNC_DIR/$COLLECTION_ID"

echo "📂 Preparazione struttura PocketBase..."
cd "$LOCAL_DIR"
for f in *; do
    # Formato: RECORDID-FILENAME.EXT
    if [[ "$f" == *-* ]]; then
        RECORD_ID="${f%%-*}"
        FILENAME="${f#*-}"
        
        TARGET="../../$TMP_SYNC_DIR/$COLLECTION_ID/$RECORD_ID"
        mkdir -p "$TARGET"
        cp "$f" "$TARGET/$FILENAME"
    fi
done
cd ../..

echo "🚀 Invio file al NAS tramite SSH (tar)..."
tar -cz -C "$TMP_SYNC_DIR" . | ssh $NAS_USER@$NAS_IP "
    mkdir -p $REMOTE_DATA_DIR/storage
    tar -xz -C $REMOTE_DATA_DIR/storage
    chmod -R 777 $REMOTE_DATA_DIR/storage
"

rm -rf "$TMP_SYNC_DIR"
echo "✅ SINCRONIZZAZIONE COMPLETATA!"
echo "Ora esegui 'bash scripts/deploy-lightweight.sh' per ricollegare i metadati."
