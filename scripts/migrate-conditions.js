import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';

dotenv.config();

const pb = new PocketBase('http://192.168.0.250:8090');

// Mapping robusto con trim e case-insensitive
const MAPPING = {
    'vg+ to near mint': 'Near Mint (NM)',
    'vg+/nm': 'Near Mint (NM)',
    'vg+': 'Very Good Plus (VG+)',
    'new': 'Mint (M)',
    'good': 'Good (G)',
    'vg': 'Very Good (VG)',
    'sealed': 'Mint (M)',
    'used - very good': 'Very Good Plus (VG+)',
    'used': 'Very Good (VG)',
    'unknown': ''
};

async function migrateConditions() {
    try {
        console.log("🚀 AVVIO MIGRAZIONE ROBUSTA...");
        const records = await pb.collection('vinyls').getFullList({
            fields: 'id,condition,artist,title'
        });

        console.log(`📦 Analisi di ${records.length} dischi...`);

        let updatedCount = 0;
        let skipCount = 0;

        for (const record of records) {
            const raw = record.condition || '';
            const clean = raw.trim().toLowerCase();
            
            const target = MAPPING[clean];

            if (target !== undefined && target !== raw) {
                // Procedi se il target è diverso dal valore attuale
                // (evitiamo loop se è già normalizzato)
                await pb.collection('vinyls').update(record.id, {
                    condition: target
                });
                updatedCount++;
            } else {
                skipCount++;
            }
        }

        console.log(`\n✅ MIGRAZIONE COMPLETATA!`);
        console.log(`✨ Aggiornati: ${updatedCount}`);
        console.log(`⏭️ Saltati (già ok o ignoti): ${skipCount}`);

    } catch (err) {
        console.error("❌ Errore:", err.message);
    }
}

migrateConditions();
