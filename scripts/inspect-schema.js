import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function inspectSchema() {
    console.log("🔍 ISPEZIONE SCHEMA COLLEZIONE (V33)...");
    try {
        // Proviamo a prendere le info della collezione
        const collection = await pb.collections.getOne('vinyls');
        console.log("\n--- SCHEMA FIELDS ---");
        collection.schema.forEach(field => {
            console.log(`- ${field.name} (${field.type})`);
        });

        console.log("\n--- SYSTEM FIELDS ---");
        console.log(`Created exists in record? Let's check a raw record.`);
        const raw = await pb.collection('vinyls').getFirstListItem("");
        console.log("Raw object keys:", Object.keys(raw));
        console.log("Value of 'created':", raw.created);
        console.log("Value of 'updated':", raw.updated);

    } catch (err) {
        console.error("❌ Errore durante l'ispezione dello schema:", err.message);
    }
}

inspectSchema();
