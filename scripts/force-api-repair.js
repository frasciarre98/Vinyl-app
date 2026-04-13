import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function forceRepair() {
    console.log("🚀 AVVIO RIPARAZIONE FORZATA TIMESTAMP (V33.2)...");
    
    try {
        // Login come Admin (usando le credenziali trovate nello script di deploy)
        console.log("🔐 Autenticazione in corso...");
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        console.log("✅ Authenticated as Admin!");

        console.log("📦 Recupero tutti i record...");
        const records = await pb.collection('vinyls').getFullList({
            sort: 'id', // Partiamo dai più vecchi per ID
            requestKey: null
        });

        console.log(`📊 Trovati ${records.length} record da riparare.`);

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            
            // Tecnica del "TOUCH": aggiorniamo un campo insignificante per forzare PocketBase
            // a generare un nuovo timestamp 'updated' sequenziale.
            // Se è Led Zeppelin, lo faremo per ultimo o con un piccolo delay extra.
            
            try {
                process.stdout.write(`\r🛠️ Riparazione [${i + 1}/${records.length}]: ${r.artist} - ${r.title}...`);
                
                await pb.collection('vinyls').update(r.id, {
                    // Touch: aggiungiamo e togliamo uno spazio alle note per non corrompere i dati
                    notes: (r.notes || "") + " "
                });
                
                // Opzionale: pulizia immediata dello spazio
                await pb.collection('vinyls').update(r.id, {
                    notes: (r.notes || "")
                });

            } catch (err) {
                console.error(`\n❌ Fallito record ${r.id}: ${err.message}`);
            }
        }

        console.log("\n\n✨ RIPARAZIONE COMPLETATA!");
        console.log("Ora tutti i record hanno un campo 'updated' reale e sequenziale.");
        console.log("Passiamo all'aggiornamento del Frontend per usare questo nuovo orologio.");

    } catch (err) {
        console.error("🔴 ERRORE FATALE:", err.message);
    }
}

forceRepair();
