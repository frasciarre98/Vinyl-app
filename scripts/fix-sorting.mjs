// fix-sorting.mjs
const PB_URL = "http://192.168.0.250:8090";
const EMAIL = "frasciarre@gmail.com";
const PASS = "Q3WLitXAKm5k2VH";

(async () => {
    console.log("🔍 Login in corso...");
    
    // Prova endpoint nuovo (PB v0.23+) poi vecchio
    let r = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: EMAIL, password: PASS })
    });

    if (!r.ok) {
        r = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identity: EMAIL, password: PASS })
        });
    }

    if (!r.ok) {
        console.error("❌ Login fallito:", r.status, await r.text());
        process.exit(1);
    }

    const { token } = await r.json();
    console.log("✅ Login effettuato!");

    // Cerca record Led Zeppelin
    const s = await fetch(`${PB_URL}/api/collections/vinyls/records?perPage=50`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const all = await s.json();
    console.log(`📀 Totale record nella risposta: ${all.items?.length}`);
    
    const lzRecords = all.items?.filter(i => 
        i.artist?.includes("Led Zeppelin") || i.title?.includes("Led Zeppelin")
    ) || [];
    console.log(`🎸 Record Led Zeppelin trovati: ${lzRecords.length}`);

    if (lzRecords.length === 0) {
        console.log("⚠️  Nessun Led Zeppelin trovato. Mostra primi 5 artisti:");
        all.items?.slice(0, 5).forEach(i => console.log(` - "${i.artist}" / "${i.title}"`));
        process.exit(0);
    }

    // "Tocca" i record per aggiornare updated timestamp
    for (const item of lzRecords) {
        const p = await fetch(`${PB_URL}/api/collections/vinyls/records/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ notes: item.notes || "" })
        });
        console.log(p.ok ? `✅ Aggiornato: ${item.artist} - ${item.title}` : `❌ Errore: ${item.id}`);
    }

    console.log("\n🏆 FATTO! Ricarica il sito, Led Zeppelin è ora in cima!");
})();
