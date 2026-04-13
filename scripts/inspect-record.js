import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const pb = new PocketBase('http://192.168.0.250:8090');

async function inspectFirstRecord() {
    try {
        const records = await pb.collection('vinyls').getList(1, 1);
        if (records.items.length > 0) {
            console.log("📄 RAW DATA DISCO #1:");
            console.log(JSON.stringify(records.items[0], null, 2));
        } else {
            console.log("❓ Nessun disco trovato.");
        }
    } catch (err) {
        console.error("❌ Errore:", err.message);
    }
}

inspectFirstRecord();
