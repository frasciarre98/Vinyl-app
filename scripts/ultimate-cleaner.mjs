import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = 'http://192.168.0.250:8090';
const pb = new PocketBase(PB_URL);

/**
 * Ultimate Brute-Force Sanitizer V37.4.1
 * Usa Regex cattive per stanare i byte UTF-8 mangiati.
 */
function superSanitize(text) {
    if (!text) return "";
    
    let clean = text;

    // --- MAPPA DI RIPARAZIONE AD ALTA PRECISIONE ---
    const map = [
        // Accenti comuni (Mangled UTF-8)
        [ /Ã /g, 'à' ], [ /Ã¡/g, 'à' ], [ /Ã\u00A0/g, 'à' ],
        [ /Ã¨/g, 'è' ], [ /Ã©/g, 'é' ],
        [ /Ã¬/g, 'ì' ], [ /Ã\u00AD/g, 'ì' ],
        [ /Ã²/g, 'ò' ], [ /Ã³/g, 'ò' ],
        [ /Ã¹/g, 'ù' ], [ /Ãº/g, 'ù' ],
        [ /Ãˆ/g, 'È' ], [ /piÃ¹/g, 'più' ], [ /potrÃ /g, 'potrà' ],
        
        // Apostrofi (Il famigerato â€™ e varianti)
        [ /â\u0080\u0099/g, "'" ], [ /â\u0080\u0098/g, "'" ], 
        [ /â€\u2122/g, "'" ], [ /â\u0080\u009C/g, '"' ], [ /â\u0080\u009D/g, '"' ],
        [ /lâ\u0080\u0099/g, "l'" ], [ /dâ\u0080\u0099/g, "d'" ], [ /unâ\u0080\u0099/g, "un'" ],
        [ /sullâ\u0080\u0099/g, "sull'" ], [ /nellâ\u0080\u0099/g, "nell'" ],
        
        // Trattini e Markdown
        [ /â\u0080\u0093/g, '-' ], [ /â\u0080\u0094/g, '-' ],
        [ /\*\*/g, '' ], [ /### /g, '' ], [ /## /g, '' ], [ /# /g, '' ]
    ];

    map.forEach(([regex, replacement]) => {
        clean = clean.replace(regex, replacement);
    });
    
    return clean.trim();
}

async function runUltimateCleaning() {
    console.log("🚀 AVVIO BONIFICA BRUTE-FORCE V37.4.1...");
    
    try {
        const records = await pb.collection('vinyls').getFullList();
        console.log(`📦 Analisi di ${records.length} record...`);
        
        let count = 0;
        for (const record of records) {
            const cleanLiner = superSanitize(record.liner_notes || "");
            const cleanNotes = superSanitize(record.notes || "");
            
            if (cleanLiner !== record.liner_notes || cleanNotes !== record.notes) {
                process.stdout.write(`  ✨ Fix: ${record.artist} - ${record.title}... `);
                await pb.collection('vinyls').update(record.id, {
                    liner_notes: cleanLiner,
                    notes: cleanNotes
                });
                console.log("OK ✅");
                count++;
            }
        }
        
        console.log(`\n🏁 BONIFICA COMPLETATA!`);
        console.log(`📊 Record finalmente puliti: ${count}`);
        
    } catch (err) {
        console.error("❌ Errore critico:", err.message);
    }
}

runUltimateCleaning();
