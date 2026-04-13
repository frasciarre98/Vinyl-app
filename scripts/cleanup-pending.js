
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://192.168.0.250:8090');

async function cleanup() {
    try {
        console.log("Logging in as admin...");
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        
        console.log("Searching for any incomplete records (missing cost)...");
        const records = await pb.collection('vinyls').getFullList({
            filter: 'average_cost = "" && avarege_cost = ""'
        });
        
        console.log(`Found ${records.length} incomplete records.`);
        
        for (const r of records.slice(0, 5)) {
            console.log(`ID: ${r.id} | Artist: ${r.artist} | Title: ${r.title}`);
        }
        
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
}

cleanup();
