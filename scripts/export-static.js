import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PB_URL = process.env.VITE_PB_URL || 'http://127.0.0.1:8090';
const pb = new PocketBase(PB_URL);
const STORAGE_DIR = path.join(__dirname, '../public/storage');
const DATA_FILE = path.join(__dirname, '../src/data/vinyls-static.json');

async function exportStaticData() {
    console.log("🚀 Starting STATIC EXPORT...");

    // 1. Ensure storage directory exists
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    try {
        // 2. Fetch all vinyls
        console.log(`🌐 Connecting to PocketBase at ${PB_URL}...`);
        const records = await pb.collection('vinyls').getFullList();

        console.log(`📦 Found ${records.length} records in PocketBase.`);

        const staticData = [];

        for (const record of records) {
            let localImagePath = null;

            if (record.image) {
                const fileName = record.image;
                const fileUrl = pb.files.getUrl(record, fileName);
                const localFileName = `${record.id}-${fileName}`;
                const destPath = path.join(STORAGE_DIR, localFileName);

                // Download image if it doesn't exist already (optional optimization)
                if (!fs.existsSync(destPath)) {
                    process.stdout.write(`  🖼️  Downloading image for ${record.title}... `);
                    try {
                        const response = await fetch(fileUrl);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const buffer = await response.buffer();
                        fs.writeFileSync(destPath, buffer);
                        console.log("OK");
                    } catch (err) {
                        console.log(`FAILED: ${err.message}`);
                    }
                }

                localImagePath = `/storage/${localFileName}`;
            }

            // Create a clean object for the static JSON
            staticData.push({
                ...record,
                image_url: localImagePath // Override with relative path
            });
        }

        // 3. Save JSON
        fs.writeFileSync(DATA_FILE, JSON.stringify(staticData, null, 2));
        console.log(`✅ Exported ${staticData.length} records to ${DATA_FILE}`);
        console.log(`✨ DONE! You can now run the app with VITE_STATIC_MODE=true`);

    } catch (err) {
        console.error("❌ Export failed!");
        console.error("Error Message:", err.message);
        console.error("Error Details:", JSON.stringify(err.data || {}, null, 2));
        if (err.status) console.error("Status Code:", err.status);
        process.exit(1);
    }
}

exportStaticData();
