import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function findZeppelin() {
    console.log("🔍 CERCANDO LED ZEPPELIN NEL DATABASE...");
    try {
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        
        // 1. Cerchiamo per testo
        const search = await pb.collection('vinyls').getFullList({
            filter: 'title ~ "Led Zeppelin" || artist ~ "Led Zeppelin"'
        });

        console.log(`\n--- RISULTATI RICERCA (${search.length}) ---`);
        search.forEach(r => {
            console.log(`ID: ${r.id}`);
            console.log(`Artista: ${r.artist} | Titolo: ${r.title}`);
            console.log(`Created: ${r.created} | Updated: ${r.updated}`);
            console.log(`Wantlist: ${r.is_wantlist ? 'SÌ' : 'NO'}`);
            console.log('-----------------------------------');
        });

        // 2. Controlliamo il conteggio totale
        const total = await pb.collection('vinyls').getList(1, 1);
        console.log(`\n📦 TOTALE RECORD NEL DATABASE: ${total.totalItems}`);

    } catch (err) {
        console.error("❌ Errore:", err.message);
    }
}

findZeppelin();
