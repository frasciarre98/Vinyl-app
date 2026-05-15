import fetch from 'node-fetch';

async function test() {
    const title = "Led Zeppelin";
    const lang = "it";
    const params = new URLSearchParams({
        action: 'query',
        prop: 'extracts|pageimages',
        titles: title,
        redirects: 1,
        format: 'json',
        exintro: 1,
        explaintext: 1,
        pithumbsize: 800
    });

    const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
    console.log("URL:", url);
    
    try {
        const response = await fetch(url);
        console.log("Status:", response.status);
        const result = await response.json();
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
