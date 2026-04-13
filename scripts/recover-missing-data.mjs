import PocketBase from 'pocketbase';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = 'http://192.168.0.250:8090';
const pb = new PocketBase(PB_URL);

const openai = new OpenAI({
    apiKey: process.env.VITE_OPENAI_API_KEY
});

/**
 * Super Sanitizer (Internal)
 * Gestisce sia stringhe che array trasformandoli in testo pulito.
 */
function sanitize(input) {
    if (!input) return "";
    // Se l'AI restituisce un array, lo uniamo con dei ritorni a capo
    let text = Array.isArray(input) ? input.join('\n') : String(input);
    
    return text
        .replace(/\*\*/g, '')
        .replace(/### /g, '').replace(/## /g, '').replace(/# /g, '')
        .replace(/â€™/g, "'").replace(/Ã /g, 'à')
        .trim();
}

async function recoverMissingData() {
    console.log("🚀 AVVIO RECUPERO DATI MANCANTI V37.5 (Stabile)...");
    
    try {
        const records = await pb.collection('vinyls').getFullList({
            filter: 'tracks = "" || tracks = "No tracks listed"'
        });

        console.log(`📦 Record incompleti trovati: ${records.length}`);

        if (records.length === 0) {
            console.log("✅ Nessun record incompleto trovato. Ottimo!");
            return;
        }

        for (const record of records) {
            console.log(`\n🔍 Analisi: ${record.artist} - ${record.title}...`);
            
            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Sei un esperto di musica. Restituisci JSON con i campi: tracks (lista fitta o array), group_members (nomi), condition (es. Very Good Plus). Lingua: Italiano." },
                        { role: "user", content: `Recupera info per: ${record.title} dell'artista ${record.artist}.` }
                    ],
                    response_format: { type: "json_object" }
                });

                const result = JSON.parse(response.choices[0].message.content);
                
                await pb.collection('vinyls').update(record.id, {
                    tracks: sanitize(result.tracks),
                    group_members: sanitize(result.group_members),
                    condition: sanitize(result.condition || "Very Good Plus (VG+)")
                });

                console.log(`✅ Record aggiornato: ${record.title}`);
            } catch (aiErr) {
                console.error(`❌ Errore AI per ${record.title}:`, aiErr.message);
            }
        }

        console.log(`\n🏁 RECUPERO COMPLETATO!`);
    } catch (err) {
        console.error("❌ Errore generale:", err.message);
    }
}

recoverMissingData();
