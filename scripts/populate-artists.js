import fs from 'fs';
import path from 'path';

// --- CONFIG ---
const PB_URL = 'http://192.168.0.250:8090';
const EMAIL = 'frasciarre@gmail.com';
const PASSWORD = 'Q3WLitXAKm5k2VH';

// Read .env for API keys
const envPath = path.resolve('.env');
let OPENAI_KEY = '';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_OPENAI_API_KEY=(.+)/);
    if (match) OPENAI_KEY = match[1].trim();
}

async function getWikipediaData(artistName) {
    try {
        let url = `https://it.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&titles=${encodeURIComponent(artistName)}&format=json&exintro=1&explaintext=1&pithumbsize=800&origin=*`;
        let res = await fetch(url);
        let data = await res.json();
        
        let pages = Object.values(data.query?.pages || {});
        if (pages.length === 0 || pages[0].pageid === undefined) {
            // Fallback to English
            url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&titles=${encodeURIComponent(artistName)}&format=json&exintro=1&explaintext=1&pithumbsize=800&origin=*`;
            res = await fetch(url);
            data = await res.json();
            pages = Object.values(data.query?.pages || {});
        }

        if (pages.length === 0 || pages[0].pageid === undefined) return { extract: '', imageUrl: '' };
        
        return {
            extract: pages[0].extract || '',
            imageUrl: pages[0].thumbnail?.source || ''
        };
    } catch (e) {
        return { extract: '', imageUrl: '' };
    }
}

async function getFunFact(artistName) {
    if (!OPENAI_KEY) return "No OpenAI key found.";
    
    const prompt = `Tell me a single, fascinating, and lesser-known fun fact or historical anecdote about the musical artist "${artistName}". Keep it concise (max 2-3 sentences), engaging, and written in Italian.`;
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Nessuna curiosità trovata.";
    } catch (e) {
        return "Errore nella generazione della curiosità.";
    }
}

async function run() {
    console.log("🚀 Avvio Popolamento Artisti...");
    
    // Login
    let token = null;
    for (const endpoint of [
        `${PB_URL}/api/collections/_superusers/auth-with-password`,
        `${PB_URL}/api/admins/auth-with-password`
    ]) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity: EMAIL, password: PASSWORD })
            });
            const data = await res.json();
            token = data.token;
            if (token) break;
        } catch(e) {}
    }
    if (!token) { console.error('❌ Login fallito.'); process.exit(1); }
    console.log("✅ Connesso a PocketBase.");

    // Fetch all vinyls
    let allRecords = [];
    let page = 1;
    while (true) {
        const res = await fetch(`${PB_URL}/api/collections/vinyls/records?perPage=500&page=${page}`, {
            headers: { 'Authorization': token }
        });
        const data = await res.json();
        if (!data.items || data.items.length === 0) break;
        allRecords.push(...data.items);
        if (page >= data.totalPages) break;
        page++;
    }
    
    // Extract unique valid artists
    const uniqueArtists = [...new Set(allRecords.map(r => r.artist).filter(a => a && a !== 'Unknown Artist' && a !== 'Pending AI' && a !== 'Error'))];
    console.log(`🔍 Trovati ${uniqueArtists.length} artisti unici.`);

    for (const artist of uniqueArtists) {
        // Check if exists
        const checkRes = await fetch(`${PB_URL}/api/collections/artists/records?filter=${encodeURIComponent(`name="${artist.replace(/"/g, '\\"')}"`)}`, {
            headers: { 'Authorization': token }
        });
        const checkData = await checkRes.json();
        
        if (checkData.items && checkData.items.length > 0) {
            console.log(`⏭️  Skipping ${artist} (Già presente)`);
            continue;
        }

        console.log(`⏳ Generazione dati per: ${artist}...`);
        
        const [wiki, funFact] = await Promise.all([
            getWikipediaData(artist),
            getFunFact(artist)
        ]);

        // Save
        const createRes = await fetch(`${PB_URL}/api/collections/artists/records`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token 
            },
            body: JSON.stringify({
                name: artist,
                bio: wiki.extract.substring(0, 5000), // PB limits string sizes optionally, 5000 is safe
                fun_fact: funFact,
                image_url: wiki.imageUrl
            })
        });

        if (createRes.ok) {
            console.log(`✅ Creato: ${artist}`);
        } else {
            console.error(`❌ Errore salvataggio ${artist}:`, await createRes.text());
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log("✨ POPOLAMENTO COMPLETATO!");
}

run().catch(console.error);
