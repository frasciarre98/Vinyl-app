import PocketBase from 'pocketbase';
import fetch from 'node-fetch';

const pb = new PocketBase('http://192.168.0.250:8090');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getWikiData(artistName) {
    const ua = "VinylCatalogBot/1.0 (https://github.com/frasciarre98/Vinyl-app; frasciarre@gmail.com)";
    
    try {
        // 1. Search for title
        const searchParams = new URLSearchParams({
            action: 'query',
            list: 'search',
            srsearch: artistName,
            utf8: '',
            format: 'json',
            srlimit: 1
        });
        const searchRes = await fetch(`https://it.wikipedia.org/w/api.php?${searchParams.toString()}`, {
            headers: { 'User-Agent': ua }
        });
        const searchJson = await searchRes.json();
        
        let title = searchJson.query?.search?.[0]?.title;
        let lang = 'it';

        if (!title) {
            // Try English
            const searchResEn = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams.toString()}`, {
                headers: { 'User-Agent': ua }
            });
            const searchJsonEn = await searchResEn.json();
            title = searchJsonEn.query?.search?.[0]?.title;
            lang = 'en';
        }

        if (!title) return null;

        // 2. Fetch summary using REST API
        const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
        const summaryRes = await fetch(summaryUrl, {
            headers: { 'User-Agent': ua, 'Accept': 'application/json' }
        });
        
        if (!summaryRes.ok) return null;
        const summaryData = await summaryRes.json();

        return {
            bio: summaryData.extract,
            image: summaryData.originalimage?.source || summaryData.thumbnail?.source || null
        };
    } catch (e) {
        return null;
    }
}

async function run() {
    console.log("🚀 AVVIO RIPARAZIONE TOTALE (V2 - CON DELAY E UA)...");
    try {
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        console.log("✅ Autenticato come Admin.");

        const artists = await pb.collection('artists').getFullList();
        console.log(`📊 Totale artisti: ${artists.length}`);

        for (const artist of artists) {
            const currentBio = artist.bio || '';
            const needsFix = currentBio.length < 50 || currentBio.includes('non trovata');
            
            if (needsFix && !['various artists', 'various'].includes(artist.name.toLowerCase())) {
                console.log(`🔎 Riparazione: ${artist.name}...`);
                const data = await getWikiData(artist.name);
                
                if (data && data.bio) {
                    await pb.collection('artists').update(artist.id, {
                        bio: data.bio.substring(0, 5000),
                        image_url: data.image || artist.image_url
                    });
                    console.log(`✅ OK: ${artist.name}`);
                } else {
                    console.log(`❌ FAIL: ${artist.name}`);
                }
                // Delay to avoid throttling
                await delay(300);
            }
        }
        console.log("\n✨ FINE.");
    } catch (e) {
        console.error("ERRORE:", e.message);
    }
}

run();
