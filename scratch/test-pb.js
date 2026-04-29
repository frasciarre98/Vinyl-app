import PocketBase from 'pocketbase';

async function test() {
    const pb = new PocketBase('http://192.168.0.250:8090');
    try {
        console.log("Testing getFullList WITHOUT sort...");
        const records = await pb.collection('vinyls').getFullList();
        console.log("Success! Fetched records:", records.length);
    } catch (err) {
        console.error("Test failed!");
        console.error(JSON.stringify(err, null, 2));
    }
}

test();
