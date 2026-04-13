import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';

dotenv.config();

const pb = new PocketBase('http://192.168.0.250:8090');

async function inspectConditions() {
    try {
        console.log("🔍 Connessione al database NAS...");
        const records = await pb.collection('vinyls').getFullList({
            fields: 'id,condition,artist,title'
        });

        const stats = {};
        records.forEach(v => {
            const cond = v.condition || 'Empty';
            stats[cond] = (stats[cond] || 0) + 1;
        });

        console.log("\n📊 STATISTICHE CONDIZIONI ATTUALI:");
        console.table(Object.entries(stats).map(([val, count]) => ({ Valore: val, Conteggio: count })));

    } catch (err) {
        console.error("❌ Errore:", err.message);
    }
}

inspectConditions();
