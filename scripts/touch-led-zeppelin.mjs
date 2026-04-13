// touch-led-zeppelin.mjs - ES Module version
import * as readline from "readline";

const PB_URL = "http://192.168.0.250:8090";

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

    // Prova vecchio endpoint, poi nuovo (PB v0.23+)
    let token = null;
    let authRes = await tryLogin(`${PB_URL}/api/admins/auth-with-password`,
        { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    if (!authRes.ok) {
        console.log("⚠️  Provo endpoint PB v0.23+...");
        authRes = await tryLogin(`${PB_URL}/api/collections/_superusers/auth-with-password`,
            { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    }

    if (!authRes.ok) {
        const err = await authRes.text();
        console.error("❌ Login fallito:", err);
        process.exit(1);
    }

    token = (await authRes.json()).token;
    console.log("✅ Login effettuato.");

    // Cerca record Led Zeppelin
    const searchRes = await fetch(
        `${PB_URL}/api/collections/vinyls/records?filter=(artist='Led Zeppelin'||title~'Led Zeppelin')&perPage=50`,
        { headers: { "Authorization": `Bearer ${token}` } }
    );
    const { items } = await searchRes.json();
    console.log(`🎵 Trovati ${items?.length ?? 0} record Led Zeppelin.`);

    if (!items || items.length === 0) {
        console.log("⚠️  Nessun record trovato. Lista primi 5 artisti:");
        const allRes = await fetch(`${PB_URL}/api/collections/vinyls/records?perPage=5`,
            { headers: { "Authorization": `Bearer ${token}` } });
        const allData = await allRes.json();
        allData.items?.forEach(i => console.log(` - ${i.artist}: ${i.title}`));
        process.exit(0);
    }

    // "Tocca" ogni record per aggiornare il timestamp updated
    for (const item of items) {
        const patchRes = await fetch(
            `${PB_URL}/api/collections/vinyls/records/${item.id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ notes: item.notes ?? "" })
            }
        );
        if (patchRes.ok) console.log(`✅ ${item.artist} - ${item.title}`);
        else console.error(`❌ Errore su ${item.id}`);
    }

    console.log("\n🏆 FATTO! Led Zeppelin è ora in cima alla collezione.");
}

run().catch(console.error);
