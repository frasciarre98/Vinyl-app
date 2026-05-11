// Elimina tutti i record con titolo "Tea for the Tillerman" aggiunti per errore
// (erano nella Collection invece che nella Wantlist)

const PB_URL = 'http://192.168.0.250:8090';
const EMAIL = 'frasciarre@gmail.com';
const PASSWORD = 'Q3WLitXAKm5k2VH';

async function cleanup() {
    // Login come superuser (PocketBase >= 0.22 usa _superusers)
    let token = null;
    for (const endpoint of [
        `${PB_URL}/api/collections/_superusers/auth-with-password`,
        `${PB_URL}/api/admins/auth-with-password`
    ]) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: EMAIL, password: PASSWORD })
            });
            const data = await res.json();
            token = data.token;
            if (token) { console.log(`✅ Login ok (${endpoint})`); break; }
        } catch(e) {}
    }
    if (!token) { console.error('❌ Login fallito su entrambi gli endpoint'); process.exit(1); }

    // Cerca i record "Tea for the Tillerman" importati da Apple Music (notes = 'Imported from Apple Music')
    const searchRes = await fetch(
        `${PB_URL}/api/collections/vinyls/records?filter=${encodeURIComponent("notes='Imported from Apple Music'")}&perPage=50`,
        { headers: { 'Authorization': token } }
    );
    const { items } = await searchRes.json();
    
    if (!items || items.length === 0) {
        console.log('ℹ️  Nessun record da eliminare trovato.');
        return;
    }

    console.log(`\n🔍 Trovati ${items.length} record da eliminare:`);
    items.forEach(r => console.log(`   - [${r.id}] ${r.artist} - ${r.title} (is_wantlist: ${r.is_wantlist})`));

    // Chiedi conferma
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise(resolve => rl.question('\nElimino tutti questi record? (s/N) ', async ans => {
        rl.close();
        if (ans.toLowerCase() !== 's') { console.log('Annullato.'); resolve(); return; }

        for (const record of items) {
            await fetch(`${PB_URL}/api/collections/vinyls/records/${record.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });
            console.log(`🗑️  Eliminato: ${record.title}`);
        }
        console.log(`\n✅ Eliminati ${items.length} record. La collection è pulita!`);
        resolve();
    }));
}

cleanup().catch(e => { console.error('Errore:', e.message); process.exit(1); });
