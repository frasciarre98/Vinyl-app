routerAdd("POST", "/api/ai/analyze", (e) => {
    const ri = e.requestInfo();
    const body = ri.body || {};

    const base64Content = body.base64Content;
    const hint = body.hint;
    const mimeType = body.mimeType || "image/jpeg";

    if (!base64Content) {
        return e.json(400, { error: "Missing base64Content in request body" });
    }

    // 2. Read API key Securely
    const apiKey = $os.getenv("VITE_OPENAI_API_KEY");
    if (!apiKey) {
        return e.json(500, { error: "Missing Server VITE_OPENAI_API_KEY configuration" });
    }

    // 3. Construct OpenAI Payload
    const payload = {
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are an expert musicologist and **Professional Vinyl Appraiser**.
Your goal is to provide **Forensic Level Metadata** and **Accurate Market Valuation** for a serious collector.
1. **Back Cover (Visual Truth):** If you see a tracklist, you are a SCANNER. Transcribe text EXACTLY as printed.
2. **Edition Identification:** Look for Catalog Numbers, Barcodes (post-1980), Label Logos, and Copyright dates.
   - No Barcode? Likely pre-1980.
   - "Digitally Remastered"? Modern Reissue.
3. **Valuation Logic (EURO) - DO NOT LOWBALL:**
   - **Common Used / Reissues:** €20 - €35 (Standard Record Store Price).
   - **Vintage VG+ (1970s/80s):** €35 - €75 (Pink Floyd, Zeppelin etc. Use Discogs Median + 20% for physical store markup).
   - **Rare Collector Items (1st Press):** €100 - €500+ (CRITICAL: If you see specific indicators like "Harvest" label without EMI logo, "Swirl" Vertigo, or specific catalog numbers, VALUE ACCORDINGLY. Do not hold back on high values).
   - *Logic:* Assume the record is in **VG+ to Near Mint** condition unless you see obvious damage. Value it as if sold in a curated Record Store, not a flea market.
   - **STRICT FORBIDDEN:** Do NOT use output "Varies", "Unknown", or "$". 
   - **STRICT REQUIRED:** You MUST output a range in EURO (€) specific to the matched edition.
   - **UNCERTAINTY FALLBACK:** If you cannot find the exact price, **ESTIMATE** based on similar albums. Use "€20-35" minimum for any playable LP. **NEVER RETURN EMPTY OR UNKNOWN**.`
            },
            {
                role: "user",
                content: [
                    {
                        type: "text", text: `Analyze this vinyl record image. ${hint ? `Hint: "${hint}"` : ''}

**OUTPUT INSTRUCTIONS:**
- Return a single JSON object.
- **_visual_evidence**: Briefly list what text you can actually read on the image.
- **tracks**: If visible, transcribe them. If not, list the standard Original LP tracks.
- **year**: Original release year.

Return JSON keys: artist, title, genre, year, tracks, group_members, average_cost (Value in EURO €, based on VG+/NM Store Price. e.g. "€45-65". JUSTIFY this in notes.), condition, label, catalog_number, edition, notes (Appraisal summary: Identify the pressing, mention Matrix/Label clues, and explain the price).`
                    },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Content}`, detail: "high" } }
                ]
            }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000,
        temperature: 0.1
    };

    try {
        // 4. Send HttpRequest
        const res = $http.send({
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            body: JSON.stringify(payload),
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey.trim()
            },
            timeout: 120 // 120 seconds
        });

        if (res.statusCode !== 200) {
            console.log("OpenAI Error Response:", res.raw);
            return e.json(res.statusCode, { error: res.json });
        }

        const data = res.json;
        if (data.error) {
            return e.json(500, { error: data.error.message });
        }

        const choice = data.choices && data.choices[0];
        if (!choice || !choice.message || !choice.message.content) {
            return e.json(500, { error: "Empty or invalid response from OpenAI" });
        }

        return e.json(200, {
            success: true,
            content: choice.message.content
        });

    } catch (err) {
        console.error("OpenAI Request Failed:", err);
        return e.json(500, { error: "Request Failed", details: err.message });
    }
});

routerAdd("POST", "/api/ai/story", (e) => {
    const ri = e.requestInfo();
    const body = ri.body || {};
    const artist = body.artist;
    const title = body.title;

    if (!artist || !title) {
        return e.json(400, { error: "Missing artist or title" });
    }

    const apiKey = $os.getenv("VITE_OPENAI_API_KEY");
    if (!apiKey) {
        return e.json(500, { error: "Missing Server VITE_OPENAI_API_KEY configuration" });
    }

    const payload = {
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "You are an expert music historian and engaging storyteller. Your goal is to write captivating 'liner notes' for a vinyl record album. Provide historical context, interesting trivia about the recording session, the artist's mindset, or the cultural impact of the album. Keep the tone passionate but informative. Do NOT use markdown. Keep it under 200 words."
            },
            {
                role: "user",
                content: `Write the liner notes and a brief backstory for the album "${title}" by ${artist}.`
            }
        ],
        max_tokens: 500,
        temperature: 0.7
    };

    try {
        const res = $http.send({
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            body: JSON.stringify(payload),
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey.trim()
            },
            timeout: 60
        });

        if (res.statusCode !== 200) {
            return e.json(res.statusCode, { error: res.json });
        }

        const choice = res.json.choices && res.json.choices[0];
        if (!choice || !choice.message || !choice.message.content) {
            return e.json(500, { error: "Invalid response from OpenAI" });
        }

        return e.json(200, {
            success: true,
            story: choice.message.content.trim()
        });

    } catch (err) {
        return e.json(500, { error: err.message });
    }
});

routerAdd("GET", "/api/discogs/search", (e) => {
    // 1. Get query param
    const query = e.requestInfo().url.query().get("q");
    const barcode = e.requestInfo().url.query().get("barcode"); // Support barcode search directly
    if (!query && !barcode) {
        return e.json(400, { error: "Missing search query or barcode parameter" });
    }

    // 2. Read Discogs Token Securely
    const token = $os.getenv("DISCOGS_TOKEN");
    if (!token) {
        return e.json(500, { error: "Missing Server DISCOGS_TOKEN configuration" });
    }

    // 3. Call Discogs API
    let url = `https://api.discogs.com/database/search?type=release&token=${token.trim()}`;
    if (barcode) {
        url += `&barcode=${encodeURIComponent(barcode)}`;
    } else if (query) {
        url += `&q=${encodeURIComponent(query)}`;
    }

    try {
        const res = $http.send({
            url: url,
            method: "GET",
            headers: {
                "User-Agent": "VinylCatalogApp/1.0"
            },
            timeout: 30
        });

        if (res.statusCode !== 200) {
            console.log("Discogs Error Response:", res.raw);
            return e.json(res.statusCode, { error: res.raw });
        }

        return e.json(200, res.json);

    } catch (err) {
        console.error("Discogs Request Failed:", err);
        return e.json(500, { error: "Request Failed", details: err.message });
    }
});
