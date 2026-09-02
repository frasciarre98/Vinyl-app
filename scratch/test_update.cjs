const pb = require('pocketbase/cjs');
const client = new pb('http://127.0.0.1:8090');
async function run() {
    try {
        await client.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        const record = await client.collection('vinyls').getFirstListItem('');
        console.log("Found:", record.id);
        await client.collection('vinyls').update(record.id, { title: record.title + " test" });
        console.log("Update success!");
    } catch (e) {
        console.error("Status:", e.status);
        console.error("Message:", e.message);
        console.error("Data:", e.data);
        console.error("Original:", e.originalError);
    }
}
run();
