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

        // 2. Fetch the extract and image for the best match
        const params = new URLSearchParams({
            action: 'query',
            prop: 'extracts|pageimages',
            titles: bestMatchTitle,
            redirects: 1, // Follow redirects
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
        if (pages.length === 0 || (pages[0].pageid === undefined && !pages[0].missing)) return null;

        const page = pages[0];
        
        // If this specific page has no extract, but we have a title, 
        // it might be a special page or a very short stub.
        if (!page.extract && page.title) {
            // Fallback: try to fetch without exintro to see if we get anything
            const fallbackParams = new URLSearchParams({
                action: 'query',
                prop: 'extracts',
                titles: page.title,
                explaintext: 1,
                exchars: 1200, // Get first 1200 chars
                format: 'json',
                origin: '*'
            });
            const fallbackUrl = `https://${lang}.wikipedia.org/w/api.php?${fallbackParams.toString()}`;
            const fallbackRes = await fetch(fallbackUrl);
            const fallbackJson = await fallbackRes.json();
            const fallbackPage = Object.values(fallbackJson.query.pages)[0];
            if (fallbackPage && fallbackPage.extract) {
                page.extract = fallbackPage.extract;
            }
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
