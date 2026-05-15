import PocketBase from 'pocketbase';
import fetch from 'node-fetch';

const pb = new PocketBase('http://192.168.0.250:8090');

async function searchWikipedia(artistName, lang) {
    const searchParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: artistName,
        utf8: '',
        format: 'json',
        srlimit: 1
    });

    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?${searchParams.toString()}`;
    
    try {
        const searchResponse = await fetch(searchUrl);
        const searchResult = await searchResponse.json();

        if (!searchResult.query || !searchResult.query.search || searchResult.query.search.length === 0) {
            return null;
        }

        const bestMatchTitle = searchResult.query.search[0].title;

        // Fetch extract
        const params = new URLSearchParams({
            action: 'query',
            prop: 'extracts|pageimages',
            titles: bestMatchTitle,
            redirects: 1,
            format: 'json',
            exintro: 1,
            explaintext: 1,
            pithumbsize: 800
        });

        const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
        const response = await fetch(url);
        const result = await response.json();

        if (!result.query || !result.query.pages) return null;

        const pages = Object.values(result.query.pages);
        const page = pages[0];

        if (!page || page.missing !== undefined) return null;

        return {
            extract: page.extract || null,
            imageUrl: page.thumbnail ? page.thumbnail.source : null,
            url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
        };
    } catch (err) {
        return null;
    }
}

async function fixLedZeppelin() {
    console.log("🚀 Riparazione Led Zeppelin...");
    try {
        const records = await pb.collection('artists').getList(1, 1, {
            filter: 'name = "Led Zeppelin"'
        });

        if (records.items.length > 0) {
            const artist = records.items[0];
            console.log(`🔎 Trovato Led Zeppelin (ID: ${artist.id})`);
            
            let data = await searchWikipedia("Led Zeppelin", "it");
            if (!data || !data.extract) {
                data = await searchWikipedia("Led Zeppelin", "en");
            }

            if (data && data.extract) {
                await pb.collection('artists').update(artist.id, {
                    bio: data.extract.substring(0, 5000),
                    image_url: data.imageUrl || artist.image_url
                });
                console.log(`✅ Led Zeppelin aggiornato!`);
            } else {
                console.log(`❌ Impossibile trovare dati per Led Zeppelin.`);
            }
        } else {
            console.log("❌ Led Zeppelin non trovato nel database.");
        }
    } catch (err) {
        console.error("💥 Errore:", err.message);
    }
}

fixLedZeppelin();
