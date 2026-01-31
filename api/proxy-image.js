
import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const decodedUrl = decodeURIComponent(url);

        // Hardcoded Project ID from source
        const PROJECT_ID = '69622969000f94b7e551';

        const response = await fetch(decodedUrl, {
            headers: {
                'X-Appwrite-Project': PROJECT_ID,
                'User-Agent': 'VinylApp-Proxy/1.0'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Upstream Error: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Forward Content-Type
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);

        // CORS Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        return res.send(buffer);
    } catch (error) {
        console.error("Proxy Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
