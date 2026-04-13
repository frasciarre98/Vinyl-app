import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';

const pb = new PocketBase('http://192.168.0.250:8090');

async function restoreMetadata() {
    console.log("🚀 Starting FINAL Deep Metadata Restoration...");

    const backupPath = path.resolve('backend/pb_migrations/restore_data.json');
    if (!fs.existsSync(backupPath)) {
        console.error("❌ Backup non trovato in:", backupPath);
        return;
    }

    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`📦 Trovati ${data.length} record nel backup.`);

    const fieldsToRestore = [
        "notes",
        "purchase_price",
        "purchase_year",
        "locked_fields",
        "liner_notes",
        "year",
        "label",
        "catalog_number",
        "edition",
        "description",
        "genre",
        "tracks",
        "is_tracks_validated",
        "rating",
        "group_members",
        "format"
    ];

    let success = 0;
    let failed = 0;

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item.id) continue;

        try {
            const updateData = {};
            for (const f of fieldsToRestore) {
                if (item[f] !== undefined && item[f] !== null) {
                    let val = item[f];
                    
                    if (f === 'locked_fields' && typeof val === 'string' && val.startsWith('[')) {
                        try {
                            val = val.substring(1, val.length - 1).split(',').map(s => s.trim());
                        } catch (e) {}
                    }
                    
                    updateData[f] = val;
                }
            }

            if (item.avarege_cost) {
                updateData.average_cost = item.avarege_cost;
            }

            // console.log(`\n🔄 Updating ${item.id} (${item.title})...`);
            const updatedRecord = await pb.collection('vinyls').update(item.id, updateData);
            
            // Log one record to check schema
            if (i === 0) {
                console.log("\nSAMPLE UPDATED RECORD:", JSON.stringify(updatedRecord, null, 2));
            }

            success++;
            if (success % 10 === 0) {
                process.stdout.write(`\r✅ Aggiornati: ${success}...`);
            }
        } catch (err) {
            failed++;
            console.error(`\n❌ Errore record ${item.id} (${item.title || 'Unknown'}):`, err.message, err.data || '');
        }
    }

    console.log(`\n\n🏁 FINITO!`);
    console.log(`✅ Successi: ${success}`);
    console.log(`❌ Falliti: ${failed}`);
}

restoreMetadata();
