const pb = require('pocketbase/cjs');
const client = new pb('http://127.0.0.1:8090');
async function run() {
    try {
        await client.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH').catch(() => {});
        const records = await client.collection('vinyls').getList(1, 1);
        if (records.items.length > 0) {
            const record = records.items[0];
            console.log("Found:", record.id);
            await client.collection('vinyls').update(record.id, { average_cost: "€99" });
            console.log("Update success!");
        }
    } catch (e) {
        console.error("Status:", e.status);
    }
}
run();
