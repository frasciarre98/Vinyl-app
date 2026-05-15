import PocketBase from 'pocketbase';
import fetch from 'node-fetch';

const pb = new PocketBase('http://192.168.0.250:8090');

async function getWikiData(artistName) {
    const ua = "VinylCatalogBot/1.0 (frasciarre@gmail.com)";
    const searchParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: `${artistName} gruppo musicale`,
        utf8: '',
        format: 'json',
        srlimit: 1
    });
    const searchRes = await fetch(`https://it.wikipedia.org/w/api.php?${searchParams.toString()}`, { headers: { 'User-Agent': ua } });
    const searchJson = await searchRes.json();
    const title = searchJson.query?.search?.[0]?.title;
    if (!title) return null;

    const summaryUrl = `https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const summaryRes = await fetch(summaryUrl, { headers: { 'User-Agent': ua } });
    return await summaryRes.json();
}

async function run() {
    await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
    const artists = await pb.collection('artists').getFullList({ filter: "name = 'America'" });
    for (const a of artists) {
        console.log("Riparando America...");
        const data = await getWikiData('America');
        if (data && data.extract) {
            await pb.collection('artists').update(a.id, {
                bio: data.extract,
                image_url: data.originalimage?.source || data.thumbnail?.source || null
            });
            console.log("✅ America riparata!");
        }
    }
}
run();
