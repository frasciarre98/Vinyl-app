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
    // 1. Search for the most relevant page title
    const searchParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: artistName,
        utf8: '',
        format: 'json',
        srlimit: 1,
        origin: '*'
    });

    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?${searchParams.toString()}`;
    
    try {
        const proxySearchUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
        const searchResponse = await fetch(proxySearchUrl);
        const proxySearchData = await searchResponse.json();
        const searchResult = JSON.parse(proxySearchData.contents);

        if (!searchResult.query || !searchResult.query.search || searchResult.query.search.length === 0) {
            return null;
        }

        const bestMatchTitle = searchResult.query.search[0].title;

        // 2. Fetch the extract and image using the legacy API (better CORS support with origin=*)
        const params = new URLSearchParams({
            action: 'query',
            prop: 'extracts|pageimages',
            titles: bestMatchTitle,
            redirects: 1,
            format: 'json',
            exintro: 1,
            explaintext: 1,
            pithumbsize: 800,
            origin: '*'
        });

        // Use AllOrigins proxy to bypass CORS issues in some browsers
        const targetUrl = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        
        const response = await fetch(url);
        const proxyData = await response.json();
        const result = JSON.parse(proxyData.contents);

        if (!result.query || !result.query.pages) {
            console.error(`Wiki: No query/pages in result for ${lang}`, result);
            return null;
        }

        const pages = Object.values(result.query.pages);
        const page = pages[0];

        if (!page || page.missing !== undefined) {
            console.warn(`Wiki: Page missing for ${lang}: ${bestMatchTitle}`);
            return null;
        }

        return {
            extract: page.extract || null,
            imageUrl: page.thumbnail ? page.thumbnail.source : null,
            url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
        };
    } catch (err) {
        console.error(`Wikipedia search error for ${lang}:`, err);
        return null;
    }
}
