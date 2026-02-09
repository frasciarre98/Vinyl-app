import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function debugDates() {
    try {
        console.log("Fetching first 10 records (SORT: -created)...");
        const list = await pb.collection('vinyls').getList(1, 10, { sort: '-created' });

        console.log(`Found ${list.totalItems} records.`);
        console.log("---------------------------------------------------");
        console.log("ID              | Created                     | Title");
        console.log("---------------------------------------------------");

        list.items.forEach(r => {
            console.log(`${r.id.padEnd(15)} | ${r.created.padEnd(27)} | ${r.title}`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

debugDates();
