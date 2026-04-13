import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function checkDatabase() {
    console.log("🔍 Diagnosi Catalogo Vinili (V32)...");
    try {
        const records = await pb.collection('vinyls').getFullList({
            sort: '-created',
            requestKey: String(Date.now())
        });

        console.log("\n--- STATISTICHE TOTALI ---");
        console.log(`Total Records: ${records.length}`);
        
        const wantlistCount = records.filter(r => r.is_wantlist).length;
        const collectionCount = records.length - wantlistCount;
        console.log(`In Collection: ${collectionCount}`);
        console.log(`In Wantlist: ${wantlistCount}`);

        const cds = records.filter(r => String(r.format || '').toLowerCase().includes('cd')).length;
        const vinyls = records.length - cds;
        console.log(`CD counted: ${cds}`);
        console.log(`Vinyl/Other counted: ${vinyls}`);

        console.log("\n--- ULTIMI 5 RECORD (ORDINATI PER DATA DI CREAZIONE) ---");
        const top5 = records.slice(0, 5);
        top5.forEach((r, i) => {
            console.log(`${i+1}. [${r.created}] ${r.artist} - ${r.title} (ID: ${r.id}, Format: ${r.format || 'N/A'})`);
        });

        console.log("\n--- RICERCA LED ZEPPELIN ---");
        const zeppelin = records.filter(r => 
            (r.artist?.toLowerCase() || '').includes('zeppelin') || 
            (r.title?.toLowerCase() || '').includes('zeppelin')
        );
        if (zeppelin.length > 0) {
            zeppelin.forEach(z => {
                console.log(`✅ Trovato: [${z.created}] ${z.artist} - ${z.title} (ID: ${z.id}, Update: ${z.updated})`);
            });
        } else {
            console.log("❌ Led Zeppelin non trovato nel database!");
        }

    } catch (err) {
        console.error("❌ Errore durante la diagnosi:", err.message);
    }
}

checkDatabase();
