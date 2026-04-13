// touch-led-zeppelin.js
// Aggiorna i record Led Zeppelin tramite API per portarli in cima alla lista

const PB_URL = "http://192.168.0.250:8090";
const readline = require("readline");

function ask(rl, question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function tryLogin(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return res;
}

async function run() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    console.log("🎵 Vinyl Catalog - Aggiornamento Led Zeppelin\n");
    const ADMIN_EMAIL = await ask(rl, "📧 Email admin PocketBase: ");
    const ADMIN_PASSWORD = await ask(rl, "🔑 Password admin: ");
    rl.close();
    
    console.log("\n🔍 Connessione a PocketBase...");

    // Prova prima il vecchio endpoint, poi il nuovo (PB v0.23+)
    let token = null;
    let authRes = await tryLogin(`${PB_URL}/api/admins/auth-with-password`, 
        { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    
    if (!authRes.ok) {
        console.log("⚠️  Vecchio endpoint fallito, provo nuovo endpoint PB v0.23+...");
        authRes = await tryLogin(`${PB_URL}/api/collections/_superusers/auth-with-password`,
            { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    }
    
    if (!authRes.ok) {
        const err = await authRes.text();
        console.error("❌ Login fallito:", err);
        process.exit(1);
    }

    const authData = await authRes.json();
    token = authData.token;
    console.log("✅ Login effettuato.");

    // 2. Cerca i record Led Zeppelin
    const searchRes = await fetch(
        `${PB_URL}/api/collections/vinyls/records?filter=(artist%3D'Led+Zeppelin'||title~'Led+Zeppelin')&perPage=50`,
        { headers: { "Authorization": `Bearer ${token}` } }
    );

    const { items } = await searchRes.json();
    console.log(`🎵 Trovati ${items.length} record Led Zeppelin.`);

    if (items.length === 0) {
        console.log("⚠️  Nessun record trovato. Verifico i nomi...");
        const allRes = await fetch(`${PB_URL}/api/collections/vinyls/records?perPage=10&sort=-id`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const allData = await allRes.json();
        console.log("Primi 10 record:", allData.items?.map(i => `${i.artist} - ${i.title}`));
        process.exit(0);
    }

    // 3. "Tocca" ogni record per aggiornare il timestamp
    for (const item of items) {
        const patchRes = await fetch(
            `${PB_URL}/api/collections/vinyls/records/${item.id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ notes: item.notes || "" }) // tocco minimo per aggiornare updated
            }
        );

        if (patchRes.ok) {
            console.log(`✅ Aggiornato: ${item.artist} - ${item.title}`);
        } else {
            console.error(`❌ Errore su ${item.id}:`, await patchRes.text());
        }
    }

    console.log("\n🏆 FATTO! Led Zeppelin è ora in cima alla collezione.");
    console.log("🔗 Ricarica il sito: http://192.168.0.250:8090");
}

run().catch(console.error);
