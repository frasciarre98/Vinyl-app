import PocketBase from 'pocketbase';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PB_URL = process.env.VITE_PB_URL || 'http://192.168.0.250:8090';
const pb = new PocketBase(PB_URL);

// Assicuriamoci che la chiave OpenAI ci sia
if (!process.env.VITE_OPENAI_API_KEY) {
    console.error("❌ Errore: VITE_OPENAI_API_KEY mancante nel file .env");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

async function generateStoryForVinyl(artist, title) {
    const prompt = `Sei un critico musicale e storico della musica esperto. 
Scrivi un breve e affascinante pezzo narrativo (circa 150-250 parole) in Italiano sul disco "${title}" dell'artista "${artist}".
Includi qualche aneddoto sulle registrazioni, curiosità storiche o l'eredità del disco.
Il tono deve essere accattivante, perfetto per la recensione di un catalogo musicale di nicchia. Non inserire "titoli" o "Saluti", restituisci solo la narrativa pura. Formatta il testo in paragrafi.`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Usiamo gpt-4o-mini per la generazione veloce ed economica
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
}

async function run() {
    console.log("🚀 Autenticazione in PocketBase...");
    try {
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        console.log("✅ Autenticato.");
    } catch (err) {
        console.error("❌ Autenticazione fallita:", err.message);
        process.exit(1);
    }

    console.log("📡 Recupero collezione...");
    const records = await pb.collection('vinyls').getFullList();
    
    // Filtra solo i dischi senza liner_notes o con liner_notes troppo corti (o placeholder)
    const recordsToProcess = records.filter(r => 
        !r.liner_notes || 
        r.liner_notes.length < 50 || 
        r.liner_notes === 'Analyzed by AI'
    );

    console.log(`📦 Trovati ${records.length} dischi. Di cui ${recordsToProcess.length} necessitano di una Storia Generata.`);

    if (recordsToProcess.length === 0) {
        console.log("✨ Tutti i dischi hanno già una storia. Nessuna azione necessaria.");
        return;
    }

    let i = 1;
    for (const record of recordsToProcess) {
        if (!record.title || !record.artist || record.title === 'Unknown Title') {
            console.log(`⚠️ Salto disco ID ${record.id} (Metadata mancanti: Artista/Titolo)`);
            continue;
        }

        console.log(`⏳ [${i}/${recordsToProcess.length}] Generando storia per: ${record.artist} - ${record.title}...`);
        
        try {
            const story = await generateStoryForVinyl(record.artist, record.title);
            
            await pb.collection('vinyls').update(record.id, {
                liner_notes: story
            });
            console.log(`✅ Aggiornato con successo.`);
            
            // Pausa per rispettare il rate limit
            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
            console.error(`❌ Errore durante generazione per ${record.id}:`, error.message);
        }
        i++;
    }

    console.log("🎉 ELABORAZIONE COMPLETATA!");
}

run();
