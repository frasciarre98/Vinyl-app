import PocketBase from 'pocketbase';
import fetch from 'node-fetch';

const pb = new PocketBase('http://192.168.0.250:8090');

async function getWikiData(lang) {
    const ua = "VinylCatalogBot/1.0 (frasciarre@gmail.com)";
    const title = lang === 'it' ? 'Compilation' : 'Compilation_album';
    const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`;
    const summaryRes = await fetch(summaryUrl, { headers: { 'User-Agent': ua } });
    if (!summaryRes.ok) return null;
    return await summaryRes.json();
}

async function run() {
    await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
    const variousNames = ['Various Artists', 'Various', 'Artisti Vari', 'V.A.', 'V/A'];
    
    // Fetch generic compilation data
    console.log("Fetching generic compilation info...");
    const wikiData = await getWikiData('it') || await getWikiData('en');

    if (!wikiData) {
        console.error("Could not fetch compilation info");
        return;
    }

    const artists = await pb.collection('artists').getFullList();
    for (const a of artists) {
        if (variousNames.includes(a.name)) {
            console.log(`Fixing ${a.name}...`);
            await pb.collection('artists').update(a.id, {
                bio: wikiData.extract,
                image_url: wikiData.originalimage?.source || wikiData.thumbnail?.source || null
            });
        }
    }
    console.log("✅ All Various Artists fixed!");
}
run();
