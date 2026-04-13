import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';

dotenv.config();

const pb = new PocketBase('http://192.168.0.250:8090');

async function auditDates() {
    try {
        console.log("🔍 Audit date in corso...");
        const records = await pb.collection('vinyls').getFullList({
            fields: 'id,artist,title,created,updated'
        });

        const missing = records.filter(r => !r.created);
        console.log(`📊 Totale dischi: ${records.length}`);
        console.log(`⚠️ Dischi senza data di creazione: ${missing.length}`);

        if (missing.length > 0) {
            console.log("\nEsempi di dischi problematici:");
            missing.slice(0, 5).forEach(m => console.log(`- ${m.artist} - ${m.title} (ID: ${m.id})`));
        }

        // Check for suspicious duplicates or "new" records
        const sorted = [...records].sort((a,b) => new Date(b.created) - new Date(a.created));
        console.log("\nTop 5 'Ultimi Aggiunti' attuali:");
        sorted.slice(0, 5).forEach(s => console.log(`- ${s.artist} - ${s.title} (Creato il: ${s.created})`));

    } catch (err) {
        console.error("❌ Errore audit:", err.message);
    }
}

auditDates();
