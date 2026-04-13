import PocketBase from 'pocketbase';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Carica .env locale
dotenv.config();

const pb = new PocketBase('http://192.168.0.250:8090');
const openai = new OpenAI({
    apiKey: process.env.VITE_OPENAI_API_KEY
});

async function massGenerateStories() {
    console.log("🚀 Starting Mac-side Batch Story Generation...");

    try {
        // Auth as Admin
        await pb.collection('_superusers').authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        console.log("✅ Authenticated as Admin on NAS.");

        // Fetch missing liner notes
        // Fetch items that don't have the (ITA) prefix
        const records = await pb.collection('vinyls').getFullList({
            filter: "liner_notes !~ '(ITA):'",
            requestKey: null
        });

        console.log(`📦 Found ${records.length} records to generate in ITALIAN.`);

        if (records.length === 0) {
            console.log("✅ All records already have Italian liner notes. Finished!");
            return;
        }

        let success = 0;
        let failed = 0;

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            
            // Allow Unknown titles but require Artist
            if (!r.artist || r.artist === 'Unknown') {
                continue;
            }

            try {
                process.stdout.write(`\r🔄 [${i+1}/${records.length}] Generating for ${r.artist} - ${r.title}...`);

                const titlePrompt = r.title === 'Unknown' ? 'un disco senza titolo' : `l'album "${r.title}"`;
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Sei un esperto storico della musica. Scrivi delle 'liner notes' (note di copertina) accattivanti in ITALIANO (max 200 parole). NON usare markdown. Sii appassionato e informativo." },
                        { role: "user", content: `Scrivi la storia e il retroscena di ${titlePrompt} di ${r.artist} in ITALIANO.` }
                    ],
                    max_tokens: 600
                });

                const story = completion.choices[0].message.content.trim();

                if (story) {
                    await pb.collection('vinyls').update(r.id, {
                        liner_notes: "🤖 AI Story (ITA): " + story
                    });
                    success++;
                }

            } catch (err) {
                console.error(`\n❌ Failed for ${r.id}:`, err.message);
                failed++;
            }

            // Small delay to avoid accidental flooding (OpenAI Free tier check)
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n\n🏁 FINISHED!`);
        console.log(`✅ Successfully updated: ${success}`);
        console.log(`❌ Failed: ${failed}`);

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
    }
}

massGenerateStories();
