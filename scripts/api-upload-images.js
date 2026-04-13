import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';

const pb = new PocketBase('http://192.168.0.250:8090');

async function uploadImages() {
    console.log("🚀 Starting API Image Upload (217MB / 800+ files)...");

    const storagePath = path.resolve('dist/storage');
    if (!fs.existsSync(storagePath)) {
        console.error("❌ Cartella dist/storage non trovata!");
        return;
    }

    const files = fs.readdirSync(storagePath);
    console.log(`📦 Trovati ${files.length} file in dist/storage.`);

    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (const file of files) {
        if (!file.includes('-')) continue;

        const recordId = file.split('-')[0];
        const filePath = path.join(storagePath, file);

        try {
            // Prepariamo i dati come FormData (necessario per l'upload di file)
            const formData = new FormData();
            
            // Carica il file in formato Blob/Buffer
            const fileData = fs.readFileSync(filePath);
            const blob = new Blob([fileData]);
            formData.append('image', blob, file.split('-').slice(1).join('-'));

            // Esegui UPDATE tramite API
            await pb.collection('vinyls').update(recordId, formData);
            
            success++;
            if (success % 10 === 0) {
                process.stdout.write(`\r🖼️ Caricate: ${success}...`);
            }
        } catch (err) {
            failed++;
            // console.error(`\n❌ Errore upload record ${recordId}:`, err.message);
        }
    }

    console.log(`\n\n🏁 FINITO!`);
    console.log(`✅ Successi: ${success}`);
    console.log(`❌ Falliti: ${failed}`);
    console.log(`⏭️ Saltati (formato nome errato): ${skipped}`);
    console.log(`\nOra puoi vedere le copertine su http://192.168.0.250:8090`);
}

uploadImages();
