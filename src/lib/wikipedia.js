export async function fetchArtistWikipediaInfo(artistName) {
    try {
        // Try Italian Wikipedia first
        let data = await searchWikipedia(artistName, 'it');
        
        // If no results, try English Wikipedia
        if (!data || !data.extract) {
            data = await searchWikipedia(artistName, 'en');
        }

        return data;
    } catch (err) {
        console.error("Wikipedia API Error:", err);
        return null;
    }
}

async function searchWikipedia(artistName, lang) {
    // We use the 'query' action with 'extracts' and 'pageimages'
    const params = new URLSearchParams({
        action: 'query',
        prop: 'extracts|pageimages',
        titles: artistName,
        format: 'json',
        exintro: 1, // Only the introductory section
        explaintext: 1, // Plain text instead of HTML
        pithumbsize: 800, // Large thumbnail
        origin: '*' // CORS
    });

    const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
    const response = await fetch(url);
    const result = await response.json();

    if (!result.query || !result.query.pages) return null;

    // The pages object has dynamic keys based on the page ID
    const pages = Object.values(result.query.pages);
    if (pages.length === 0 || pages[0].pageid === undefined) return null;

    const page = pages[0];
    return {
        extract: page.extract,
        imageUrl: page.thumbnail ? page.thumbnail.source : null,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
    };
}
