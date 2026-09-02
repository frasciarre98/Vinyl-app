const https = require('https');

const token = "TZHpdTqpbILfljqYsaQCuhvDuCYigAuwVAQrNMsN";
const query = encodeURIComponent("Pink Floyd Ummagumma");
const url = `https://api.discogs.com/database/search?q=${query}&token=${token}&type=release`;

https.get(url, { headers: { 'User-Agent': 'VinylApp/1.0' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log("Found:", json.results.length);
        if (json.results.length > 0) {
            const first = json.results[0];
            console.log("First result:", JSON.stringify(first, null, 2));
            
            // fetch release
            const releaseUrl = `https://api.discogs.com/releases/${first.id}?token=${token}`;
            https.get(releaseUrl, { headers: { 'User-Agent': 'VinylApp/1.0' } }, (r) => {
                let rdata = '';
                r.on('data', chunk => rdata += chunk);
                r.on('end', () => {
                     const rjson = JSON.parse(rdata);
                     console.log("Lowest Price:", rjson.lowest_price);
                });
            });
        }
    });
});
