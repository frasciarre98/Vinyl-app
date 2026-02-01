import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURATION
const POCKETBASE_URL = 'http://127.0.0.1:8090';

// Usage: node scripts/seed-pocketbase.js <email> <password>
const adminEmail = process.argv[2];
const adminPassword = process.argv[3];

if (!adminEmail || !adminPassword) {
    console.error("Usage: node scripts/seed-pocketbase.js <admin_email> <admin_password>");
    process.exit(1);
}

const pb = new PocketBase(POCKETBASE_URL);

// Disable auto-cancellation to allow parallel requests if needed (though we'll do sequential)
pb.autoCancellation(false);

const BACKUP_DIR = path.join(__dirname, '../backup');
const IMAGES_DIR = path.join(BACKUP_DIR, 'images');
const DATA_FILE = path.join(BACKUP_DIR, 'vinyls.json');

async function main() {
    try {
        console.log("🔐 Authenticating as Admin...");
        await pb.admins.authWithPassword(adminEmail, adminPassword);
        console.log("✅ Authenticated.");

        // 1. Reset Collection
        console.log("🛠️  Resetting 'vinyls' collection...");
        try {
            const existing = await pb.collections.getOne('vinyls');
            console.log("   Deleting broken 'vinyls' collection...");
            await pb.collections.delete(existing.id);
        } catch (err) {
            // Ignore if not found
        }

        console.log("   Creating 'vinyls' collection...");
        await pb.collections.create({
            name: 'vinyls',
            type: 'base',
            listRule: "", // Public
            viewRule: "", // Public
            createRule: null, // Admin only
            updateRule: null, // Admin only
            deleteRule: null, // Admin only
            fields: [
                { name: 'title', type: 'text' },
                { name: 'artist', type: 'text' },
                { name: 'year', type: 'text' },
                { name: 'genre', type: 'text' },
                { name: 'condition', type: 'text' },
                { name: 'description', type: 'text' },
                { name: 'format', type: 'text' },
                { name: 'group_members', type: 'text' },
                { name: 'avarege_cost', type: 'text' },
                { name: 'tracks', type: 'text' },
                { name: 'notes', type: 'text' },
                { name: 'original_filename', type: 'text' },
                { name: 'image', type: 'file', options: { mimeTypes: ['image/*'] } },
                { name: 'is_tracks_validated', type: 'bool' },
                { name: 'rating', type: 'number' },
                { name: 'is_price_locked', type: 'bool' },
                { name: 'label', type: 'text' },
                { name: 'catalog_number', type: 'text' },
                { name: 'edition', type: 'text' }
            ]
        });
        console.log("✅ Collection created.");

        // 2. Read Backup Data
        const vinyls = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log(`📂 Found ${vinyls.length} records to import.`);

        // 3. Import
        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;

        for (const [index, record] of vinyls.entries()) {
            const tempId = record.$id; // Appwrite ID, we won't use it as PB ID but good for ref

            // Check if exists (by original title+artist to avoid duplicates?)
            // Or just blind insert? Blind insert is risky if run multiple times.
            // Blind insert for seeding/restore
            const existing = { totalItems: 0 };

            const formData = new FormData();

            // Text Fields
            const fields = [
                'title', 'artist', 'year', 'genre', 'condition', 'description',
                'format', 'group_members', 'avarege_cost', 'tracks', 'notes',
                'original_filename', 'label', 'catalog_number', 'edition'
            ];

            fields.forEach(f => {
                if (record[f] !== null && record[f] !== undefined) {
                    formData.append(f, String(record[f]));
                }
            });

            // Bool/Number fields
            if (record.is_tracks_validated) formData.append('is_tracks_validated', 'true');
            if (record.is_price_locked) formData.append('is_price_locked', 'true');
            if (record.rating) formData.append('rating', record.rating);

            // Image
            if (record.image_url) {
                // Extract ID: .../files/ID/...
                const match = record.image_url.match(/files\/([^\/]+)\//);
                if (match) {
                    const fileId = match[1];
                    // Search for file in backup/images
                    const files = fs.readdirSync(IMAGES_DIR);
                    const imageFile = files.find(f => f.startsWith(fileId));

                    if (imageFile) {
                        const filePath = path.join(IMAGES_DIR, imageFile);
                        const blob = new Blob([fs.readFileSync(filePath)]);
                        formData.append('image', blob, imageFile);
                    }
                }
            }

            try {
                await pb.collection('vinyls').create(formData);
                process.stdout.write('.');
                successCount++;
            } catch (err) {
                process.stdout.write('E');
                console.error(`\n❌ Failed to import ${record.title}: ${err.message}`);
                failCount++;
            }
        }

        console.log(`\n\n✅ Import Complete!`);
        console.log(`   - Imported: ${successCount}`);
        console.log(`   - Skipped: ${skipCount}`);
        console.log(`   - Failed: ${failCount}`);

    } catch (err) {
        console.error("\n❌ Setup Failed:", err);
    }
}

main();
