import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function updateSchema() {
    console.log("🚀 Authenticating as Admin...");
    try {
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        console.log("✅ Authenticated!");

        console.log("🔍 Fetching 'vinyls' collection...");
        const collection = await pb.collections.getOne('vinyls');
        
        // Aggiungi i campi mancanti
        const fieldsToAdd = [
            { name: 'average_cost', type: 'text' },
            { name: 'group_members', type: 'text' },
            { name: 'format', type: 'text' }
        ];

        let addedCount = 0;
        for (const f of fieldsToAdd) {
            const exists = collection.fields.find(field => field.name === f.name);
            if (!exists) {
                collection.fields.push({
                    name: f.name,
                    type: f.type,
                });
                addedCount++;
                console.log(`➕ Added field: ${f.name}`);
            } else {
                console.log(`ℹ️ Field already exists: ${f.name}`);
            }
        }

        if (addedCount > 0) {
            console.log("💾 Saving collection schema...");
            await pb.collections.update(collection.id, collection);
            console.log("✅ Schema updated successfully!");
        } else {
            console.log("✅ No schema changes needed.");
        }

    } catch (err) {
        console.error("❌ Schema update failed:", err.message, err.data || '');
    }
}

updateSchema();
