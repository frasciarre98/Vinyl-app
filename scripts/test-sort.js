
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function testSort() {
    try {
        console.log("Logging in as admin...");
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        
        const sortTests = ['-id', 'title', '-created', '-sort_priority', 'created', 'id'];
        
        for (const sortField of sortTests) {
            try {
                process.stdout.write(`Testing sort: ${sortField}... `);
                await pb.collection('vinyls').getList(1, 1, { 
                    sort: sortField,
                    requestKey: null // Disable auto-cancellation
                });
                console.log(`✅ OK`);
            } catch (err) {
                console.log(`❌ FAILED: ${err.message}`);
            }
        }
        
        process.exit(0);
    } catch (err) {
        console.error("Auth failed:", err);
        process.exit(1);
    }
}

testSort();
