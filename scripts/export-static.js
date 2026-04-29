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
    console.log("🚀 Starting STATIC EXPORT V37.1 (Full Metadata Sync)...");

    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    try {
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

                if (!fs.existsSync(destPath)) {
                    process.stdout.write(`  🖼️  Downloading image for ${record.title || record.id}... `);
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

            // --- DEEP FIELD MAPPING (V37.1) ---
            // Ensure every possible field is captured and sanitized
            const cleanRecord = {
                id: record.id,
                artist: record.artist || 'Unknown Artist',
                title: record.title || 'Unknown Album',
                genre: record.genre || '',
                year: record.year || '',
                format: record.format || 'Vinyl',
                label: record.label || '',
                catalog_number: record.catalog_number || '',
                edition: record.edition || '',
                tracks: record.tracks || '', // Crucial for Vercel
                group_members: record.group_members || '',
                notes: record.notes || '',
                condition: record.condition || 'N/A',
                liner_notes: record.liner_notes || '',
                rating: record.rating || 0,
                sort_priority: record.sort_priority || 0,
                purchase_price: record.purchase_price || '',
                purchase_year: record.purchase_year || '',
                average_cost: record.average_cost || record.avarege_cost || '', // Handle typo fallback
                is_tracks_validated: !!record.is_tracks_validated,
                is_price_locked: !!record.is_price_locked,
                image_url: localImagePath,
                created: record.created || '',
                updated: record.updated || ''
            };

            staticData.push(cleanRecord);
        }

        // 3. Save JSON with explicit UTF-8 and formatting
        const jsonContent = JSON.stringify(staticData, null, 2);
        fs.writeFileSync(DATA_FILE, jsonContent, 'utf8');
        
        console.log(`✅ Exported ${staticData.length} records to ${DATA_FILE}`);
        console.log(`✨ DONE! UTF-8 Encoding confirmed.`);

    } catch (err) {
        console.error("❌ Export failed!");
        console.error("Error Message:", err.message);
        process.exit(1);
    }
}

exportStaticData();
