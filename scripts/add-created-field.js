import PocketBase from 'pocketbase';
const pb = new PocketBase('http://192.168.0.250:8090');

async function fix() {
    await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH').catch(() => {});
    const collection = await pb.collections.getOne('vinyls');
    
    // Check if created exists
    const hasCreated = collection.fields.some(f => f.name === 'created');
    const hasUpdated = collection.fields.some(f => f.name === 'updated');

    if (!hasCreated) {
        collection.fields.push({
            id: "autodate2990389176",
            name: "created",
            type: "autodate",
            system: false,
            required: false,
            presentable: false,
            unique: false,
            options: {
                onCreate: true,
                onUpdate: false
            }
        });
    }

    if (!hasUpdated) {
        collection.fields.push({
            id: "autodate3332085495",
            name: "updated",
            type: "autodate",
            system: false,
            required: false,
            presentable: false,
            unique: false,
            options: {
                onCreate: true,
                onUpdate: true
            }
        });
    }

    if (!hasCreated || !hasUpdated) {
        try {
            await pb.collections.update('vinyls', collection);
            console.log("Successfully added created/updated fields to schema.");
        } catch(e) {
            console.error("Failed:", e.data ? JSON.stringify(e.data) : e.message);
        }
    } else {
        console.log("Fields already exist.");
    }
}
fix();
