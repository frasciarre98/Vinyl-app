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
        const searchResponse = await fetch(searchUrl);
        const searchResult = await searchResponse.json();

        if (!searchResult.query || !searchResult.query.search || searchResult.query.search.length === 0) {
            return null;
        }

        const bestMatchTitle = searchResult.query.search[0].title;
        const encodedTitle = encodeURIComponent(bestMatchTitle.replace(/ /g, '_'));

        // 2. Fetch the summary using the modern REST API
        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
        
        const summaryResponse = await fetch(summaryUrl, {
            headers: { 'Accept': 'application/json' }
        });

        if (!summaryResponse.ok) {
            // Fallback to legacy API if REST fails
            const legacyParams = new URLSearchParams({
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
            const legacyUrl = `https://${lang}.wikipedia.org/w/api.php?${legacyParams.toString()}`;
            const legacyResponse = await fetch(legacyUrl);
            const legacyResult = await legacyResponse.json();
            const page = Object.values(legacyResult.query.pages)[0];
            
            if (!page || page.missing) return null;
            
            return {
                extract: page.extract || null,
                imageUrl: page.thumbnail ? page.thumbnail.source : null,
                url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
            };
        }

        const summaryData = await summaryResponse.json();

        return {
            extract: summaryData.extract || null,
            imageUrl: summaryData.originalimage ? summaryData.originalimage.source : (summaryData.thumbnail ? summaryData.thumbnail.source : null),
            url: summaryData.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodedTitle}`
        };
    } catch (err) {
        console.error(`Wikipedia search error for ${lang}:`, err);
        return null;
    }
}
