import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function check() {
    try {
        console.log("Fetching list...");
        // Fetch WITHOUT sort first to verify connection and existence
        const list = await pb.collection('vinyls').getList(1, 10);

        console.log("--- TOP 10 (No Sort) ---");
        list.items.forEach(d => {
            console.log(`[${d.created}] ${d.artist} - ${d.title} (ID: ${d.id})`);
        });

        console.log("\n--- SEARCH 'Patti Smith' ---");
        const patti = await pb.collection('vinyls').getList(1, 10, {
            filter: 'artist ~ "Patti Smith"'
        });

        if (patti.items.length === 0) {
            console.log("❌ Patti Smith NOT FOUND in search");
        } else {
            patti.items.forEach(d => {
                console.log("FULL RECORD:", JSON.stringify(d, null, 2));
            });
        }

    } catch (e) {
        console.error(e);
    }
}

check();
