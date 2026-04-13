console.log(">>> MAGIC HOOK LOADED (Universal V37.3): " + new Date().toISOString());

routerAdd("POST", "/api/custom-ai-analyze", (e) => {
    try {
        const bytesToString = function(bytes) {
            if (!bytes) return "";
            if (typeof bytes === 'string') return bytes;
            let str = "";
            for (let i = 0; i < bytes.length; i++) {
                str += String.fromCharCode(bytes[i]);
            }
            return str;
        };

        const sanitizeText = function(text) {
            if (!text) return "";
            // 1. Fix UTF-8 mangling
            let clean = text
                .replace(/Ã /g, 'à').replace(/Ã¡/g, 'à')
                .replace(/Ã¨/g, 'è').replace(/Ã©/g, 'é')
                .replace(/Ã¬/g, 'ì').replace(/Ã­/g, 'ì')
                .replace(/Ã²/g, 'ò').replace(/Ã³/g, 'ò')
                .replace(/Ã¹/g, 'ù').replace(/Ãº/g, 'ù')
                .replace(/â€™/g, "'").replace(/â€/g, '"')
                .replace(/â€œ/g, '"').replace(/â€ /g, '"');
            
            // 2. Strip Markdown (Bold, Headers) for clean UI
            clean = clean.replace(/\*\*/g, '').replace(/### /g, '').replace(/## /g, '').replace(/# /g, '');
            
            return clean.trim();
        };

        const optimizedBase64Encode = function(bytes) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            const chunks = [];
            const l = bytes.length;
            for (let i = 0; i < l; i += 3) {
                const b0 = bytes[i];
                const b1 = i + 1 < l ? bytes[i + 1] : 0;
                const b2 = i + 2 < l ? bytes[i + 2] : 0;
                chunks.push(chars[b0 >> 2]);
                chunks.push(chars[((b0 & 3) << 4) | (b1 >> 4)]);
                if (i + 1 < l) chunks.push(chars[((b1 & 15) << 2) | (b2 >> 6)]); else chunks.push('=');
                if (i + 2 < l) chunks.push(chars[b2 & 63]); else chunks.push('=');
            }
            return chunks.join('');
        };

        let data = {};
        try { data = e.requestInfo().body || {}; } catch(err) {}
        if (!data || Object.keys(data).length === 0) {
            try {
                const raw = bytesToString(e.request().body);
                if (raw && raw.startsWith("{")) data = JSON.parse(raw);
            } catch(p) {}
        }

        const recordId = data.recordId;
        const filename = (data.filename || "").split('?')[0];
        const apiKey = data.apiKey;
        const provider = (data.provider || "openai").toLowerCase();
        const collectionId = data.collectionId || "vinyls";
        const hint = data.hint || "";
        const base64Override = data.base64Override;

        console.log("[AI Proxy V37.3] Analisi Full Metadata per: " + filename);

        if (!filename || !apiKey) {
            return e.json(400, { error: "Missing required data (Filename or API Key)" });
        }

        let base64Content = "";
        
        if (base64Override) {
            base64Content = base64Override;
        } else {
            if (!recordId) return e.json(400, { error: "Missing RecordID for disk read" });
            
            let filePath = "/pb/pb_data/storage/" + collectionId + "/" + recordId + "/" + filename;
            let fileBytes;
            try {
                fileBytes = $os.readFile(filePath);
            } catch (pathErr) {
                filePath = "/pb/pb_data/storage/vinyls/" + recordId + "/" + filename;
                fileBytes = $os.readFile(filePath);
            }
            
            try {
                if (typeof $security !== 'undefined' && $security.base64Encode) {
                    base64Content = $security.base64Encode(fileBytes);
                } else {
                    base64Content = optimizedBase64Encode(fileBytes);
                }
            } catch (f) {
                base64Content = optimizedBase64Encode(fileBytes);
            }
        }
        
        const ext = filename.split('.').pop().toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === "png") mimeType = "image/png";

        const headers = { "Content-Type": "application/json" };
        if (provider !== "gemini") {
            headers["Authorization"] = "Bearer " + apiKey;
        }

        const promptSystem = "Identify this vinyl album. Return ONLY JSON with artist, title, genre, year, tracks, group_members, average_cost, condition, label, catalog_number, edition, notes, liner_notes. Clean Italian only (no markdown).";

        const aiRes = $http.send({
            url: provider === "gemini" ? 
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey :
                "https://api.openai.com/v1/chat/completions",
            method: "POST",
            body: JSON.stringify(provider === "gemini" ? {
                contents: [{ parts: [{ text: promptSystem + (hint ? " User states: '" + hint + "'." : "") }, { inline_data: { mime_type: mimeType, data: base64Content } }] }]
            } : {
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: [
                    { type: "text", text: promptSystem + (hint ? " User states: '" + hint + "'." : "") },
                    { type: "image_url", image_url: { url: "data:" + mimeType + ";base64," + base64Content } }
                ]}],
                response_format: { type: "json_object" }
            }),
            headers: headers
        });

        const responseBodyStr = bytesToString(aiRes.body);

        if (aiRes.statusCode !== 200) {
            return e.json(aiRes.statusCode, { error: "AI Error: " + responseBodyStr });
        }

        const parsed = JSON.parse(responseBodyStr);
        let result = {};
        if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            try { result = JSON.parse(parsed.choices[0].message.content); } catch(e) { result = parsed; }
        } else if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
            try {
                const txt = parsed.candidates[0].content.parts[0].text;
                result = JSON.parse(txt.replace(/```json|```/g, ""));
            } catch(e) { result = parsed; }
        } else {
            result = parsed;
        }

        const sanitize = (val, max) => sanitizeText(String(val || '').substring(0, max));
        
        return e.json(200, {
            artist: sanitize(result.artist || 'Unknown Artist', 100),
            title: sanitize(result.title || 'Unknown Title', 100),
            genre: sanitize(result.genre, 100),
            year: sanitize(result.year, 10),
            average_cost: sanitize(result.average_cost, 50), 
            label: sanitize(result.label, 100),
            catalog_number: sanitize(result.catalog_number, 50),
            edition: sanitize(result.edition, 100),
            notes: sanitize(result.notes, 4000),
            tracks: sanitize(result.tracks, 4000),
            liner_notes: sanitize(result.liner_notes, 5000),
            group_members: sanitize(result.group_members, 1000),
            condition: sanitize(result.condition, 100)
        });

    } catch (err) {
        return e.json(500, { error: "Backend Proxy Crash V37.3: " + err.message });
    }
});

routerAdd("POST", "/api/ai/story", (e) => {
    try {
        const bytesToString = function(bytes) {
            if (!bytes) return "";
            if (typeof bytes === 'string') return bytes;
            let str = "";
            for (let i = 0; i < bytes.length; i++) {
                str += String.fromCharCode(bytes[i]);
            }
            return str;
        };

        const sanitizeText = function(text) {
            if (!text) return "";
            let clean = text
                .replace(/Ã /g, 'à').replace(/Ã¡/g, 'à')
                .replace(/Ã¨/g, 'è').replace(/Ã©/g, 'é')
                .replace(/Ã¬/g, 'ì').replace(/Ã­/g, 'ì')
                .replace(/Ã²/g, 'ò').replace(/Ã³/g, 'ò')
                .replace(/Ã¹/g, 'ù').replace(/Ãº/g, 'ù')
                .replace(/â€™/g, "'").replace(/â€/g, '"')
                .replace(/â€œ/g, '"').replace(/â€ /g, '"');
            
            clean = clean.replace(/\*\*/g, '').replace(/### /g, '').replace(/## /g, '').replace(/# /g, '');
            return clean.trim();
        };

        let data = {};
        try { data = e.requestInfo().body || {}; } catch(err) {}
        
        const artist = data.artist;
        const title = data.title;
        const apiKey = data.apiKey;

        console.log("[AI Story V37.3] Story for: " + artist + " - " + title);

        if (!artist || !title || !apiKey) {
            return e.json(400, { error: "Missing Artist, Title or API Key" });
        }

        const res = $http.send({
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "system",
                    content: "Sei un esperto critico musicale. Scrivi una storia appassionante per questo album in ITALIANO. No markdown, solo testo pulito."
                }, {
                    role: "user",
                    content: "Liner notes per '" + title + "' - '" + artist + "'."
                }]
            }),
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey
            }
        });

        const bodyStr = bytesToString(res.body);
        const body = JSON.parse(bodyStr);
        
        if (res.statusCode !== 200) {
            return e.json(res.statusCode, { error: "OpenAI Error: " + (body.error?.message || "Unknown") });
        }

        return e.json(200, { story: sanitizeText(body.choices[0].message.content) });

    } catch (err) {
        return e.json(500, { error: "Story Proxy Crash V37.3: " + err.message });
    }
});
