import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURATION
const POCKETBASE_URL = 'http://127.0.0.1:8090'; // Default local address

// Initialize Client
const pb = new PocketBase(POCKETBASE_URL);

const BACKUP_DIR = path.join(__dirname, '../backup');
const IMAGES_DIR = path.join(BACKUP_DIR, 'images');

// Ensure directories exist
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

async function downloadFile(url, destPath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const fileStream = fs.createWriteStream(destPath, { flags: 'wx' });
    await finished(Readable.fromWeb(res.body).pipe(fileStream));
}

async function backup() {
    console.log('🚀 Starting PocketBase Backup...');
    console.log(`📡 Connecting to ${POCKETBASE_URL}...`);

    try {
        // Optional: auth if needed (for private data)
        // await pb.admins.authWithPassword('admin@example.com', 'password');

        // 1. BACKUP DATABASE
        console.log('📄 Fetching documents...');

        const records = await pb.collection('vinyls').getFullList({
            sort: '-created',
        });

        console.log(`   Fetched ${records.length} records.`);

        const jsonPath = path.join(BACKUP_DIR, 'vinyls.json');
        fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));
        console.log(`✅ Saved documents to ${jsonPath}`);

        // 2. BACKUP IMAGES
        console.log('🖼️  Backing up images...');
        let imageCount = 0;
        let skipCount = 0;

        for (const record of records) {
            if (record.image) {
                const imageUrl = pb.files.getUrl(record, record.image);
                const fileName = record.image; // e.g. "filename_hash.jpg"
                const savePath = path.join(IMAGES_DIR, fileName);

                if (fs.existsSync(savePath)) {
                    process.stdout.write('S'); // Skipped
                    skipCount++;
                    continue;
                }

                try {
                    await downloadFile(imageUrl, savePath);
                    process.stdout.write('.');
                    imageCount++;
                } catch (err) {
                    process.stdout.write('E');
                    console.error(`\n❌ Failed to download ${fileName}:`, err.message);
                }
            }
        }

        console.log(`\n\n✅ Backup Complete!`);
        console.log(`   - Documents: ${records.length}`);
        console.log(`   - Images Downloaded: ${imageCount}`);
        console.log(`   - Images Skipped (Already Existed): ${skipCount}`);
        console.log(`   - Location: ${BACKUP_DIR}`);

    } catch (err) {
        console.error('\n❌ Backup failed:', err);
        console.log('💡 Tip: Ensure PocketBase is running at ' + POCKETBASE_URL);
    }
}

backup();
