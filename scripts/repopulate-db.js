
import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';

const pb = new PocketBase('http://192.168.0.250:8090');

async function repopulate() {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.error("❌ Errore: Devi passare email e password allo script.");
        console.error("Esempio: node scripts/repopulate-db.js admin@example.com password123");
        return;
    }

    console.log("🚀 Starting Magic Repopulation...");
    
    // 1. Leggi il backup statico
    const backupPath = path.resolve('src/data/vinyls-static.json');
    if (!fs.existsSync(backupPath)) {
        console.error("❌ Backup non trovato in:", backupPath);
        return;
    }
    
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`📦 Trovati ${data.length} record nel backup.`);

    // 2. Auth (Usa le credenziali passate)
    try {
        await pb.admins.authWithPassword(email, password);
        console.log("✅ Autenticato come Admin.");
    } catch (e) {
        console.error("❌ Auth fallita! Controlla email e password e riprova.");
        return;
    }

    // 3. Importazione
    let success = 0;
    let failed = 0;

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        try {
            // Puliamo l'oggetto dai campi che PocketBase genera da solo
            const { id, created, updated, collectionId, collectionName, image_url, ...cleanData } = item;
            
            // Creazione record
            await pb.collection('vinyls').create(cleanData);
            success++;
            if (success % 10 === 0) process.stdout.write(`\r✅ Inseriti: ${success}...`);
        } catch (err) {
            failed++;
        }
    }

    console.log(`\n\n🏁 FINITO!`);
    console.log(`✅ Successi: ${success}`);
    console.log(`❌ Falliti: ${failed}`);
    console.log(`\nVai su http://192.168.0.250:8090 per vedere i tuoi vinili!`);
}

repopulate();
