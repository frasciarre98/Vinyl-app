import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = 'http://192.168.0.250:8090';
const pb = new PocketBase(PB_URL);

function sanitizeText(text) {
    if (!text) return "";
    // 1. Fix UTF-8 mangling
    let clean = text
        .replace(/Ã /g, 'à').replace(/Ã¡/g, 'à')
        .replace(/Ã¨/g, 'è').replace(/Ã©/g, 'é')
        .replace(/Ã¬/g, 'ì').replace(/Ã­/g, 'ì')
        .replace(/Ã²/g, 'ò').replace(/Ã³/g, 'ò')
        .replace(/Ã¹/g, 'ù').replace(/Ãº/g, 'ù')
        .replace(/â€™/g, "'").replace(/â€/g, '"')
        .replace(/â€œ/g, '"').replace(/â€ /g, '"');
    
    // 2. Strip Markdown
    clean = clean.replace(/\*\*/g, '').replace(/### /g, '').replace(/## /g, '').replace(/# /g, '');
    
    return clean.trim();
}

async function repairAllRecords() {
    console.log("🚀 Starting MASS REPAIR V37.3...");
    
    try {
        const records = await pb.collection('vinyls').getFullList();
        console.log(`📦 Records found: ${records.length}`);
        
        let count = 0;
        for (const record of records) {
            const cleanLiner = sanitizeText(record.liner_notes);
            const cleanNotes = sanitizeText(record.notes);
            
            // Only update if something changed
            if (cleanLiner !== record.liner_notes || cleanNotes !== record.notes) {
                process.stdout.write(`  🔧 Repairing: ${record.artist} - ${record.title}... `);
                await pb.collection('vinyls').update(record.id, {
                    liner_notes: cleanLiner,
                    notes: cleanNotes
                });
                console.log("FIXED");
                count++;
            }
        }
        
        console.log(`\n✨ DONE! Repaired ${count} records.`);
    } catch (err) {
        console.error("❌ Mass repair failed:", err.message);
    }
}

repairAllRecords();
