import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function inspectSorting() {
    console.log("🔍 ISPEZIONE PROFONDA ORDINAMENTO (V33)...");
    try {
        // Prendiamo i primi 20 record SENZA ordinamento per vedere come arrivano
        const records = await pb.collection('vinyls').getList(1, 20);

        console.log("\n--- ANALISI TIMESTAMP ---");
        records.items.forEach((r, i) => {
            console.log(`${i+1}. [ID: ${r.id}] ${r.artist} - ${r.title}`);
            console.log(`   > Created: ${r.created}`);
            console.log(`   > Updated: ${r.updated}`);
        });

        // Controlliamo se ci sono record con data identica
        const createdDates = records.items.map(r => r.created);
        const uniqueDates = new Set(createdDates).size;
        console.log(`\nUnique Created Dates in top 20: ${uniqueDates} / 20`);
        
        if (uniqueDates === 1) {
            console.log("⚠️ ATTENZIONE: Tutti i record hanno la stessa data di creazione! L'ordine cronologico è IMPOSSIBILE senza un campo extra.");
        }

    } catch (err) {
        console.error("❌ Errore durante l'ispezione:", err.message);
    }
}

inspectSorting();
