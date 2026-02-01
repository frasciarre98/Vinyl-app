import PocketBase from 'pocketbase';

// CONFIGURATION
const POCKETBASE_URL = 'http://127.0.0.1:8090';

// Usage: node scripts/fix-rules.js <email> <password>
const adminEmail = process.argv[2];
const adminPassword = process.argv[3];

if (!adminEmail || !adminPassword) {
    console.error("Usage: node scripts/fix-rules.js <admin_email> <admin_password>");
    process.exit(1);
}

const pb = new PocketBase(POCKETBASE_URL);

async function main() {
    try {
        console.log("🔐 Authenticating as Admin...");
        await pb.admins.authWithPassword(adminEmail, adminPassword);

        console.log("🛠️  Updating 'vinyls' collection rules...");

        // Fetch current collection
        const collection = await pb.collections.getOne('vinyls');

        // Update rules to "" (Public)
        collection.listRule = "";
        collection.viewRule = "";

        // Optional: Allow public creation? Probably not. 
        // Only authenticated users should create/update/delete?
        // For now, let's stick to reading.
        // collection.createRule = "@request.auth.id != ''";
        // collection.updateRule = "@request.auth.id != ''";
        // collection.deleteRule = "@request.auth.id != ''";

        await pb.collections.update('vinyls', collection);

        console.log("✅ Rules updated! 'vinyls' collection is now publicly readable.");

    } catch (err) {
        console.error("❌ Failed to update rules:", err);
    }
}

main();
