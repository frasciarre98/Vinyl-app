console.log(">>> MAGIC HOOK LOADED (Universal V38.13): " + new Date().toISOString());

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

        const stringToBytes = function(str) {
            let bytes = [];
            for (let i = 0; i < str.length; i++) {
                let charCode = str.charCodeAt(i);
                if (charCode < 0x80) bytes.push(charCode);
                else if (charCode < 0x800) {
                    bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
                } else if (charCode < 0xd800 || charCode >= 0xe000) {
                    bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
                }
            }
            return bytes;
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

        const sanitizeText = function(text) {
            if (!text) return "";
            let clean = text
                .replace(/Ã /g, 'à').replace(/Ã¡/g, 'à')
                .replace(/Ã¨/g, 'è').replace(/Ã©/g, 'é')
                .replace(/Ã¬/g, 'ì').replace(/Ã­/g, 'ì')
                .replace(/Ã²/g, 'ò').replace(/Ã³/g, 'ò')
                .replace(/Ã¹/g, 'ù').replace(/Ãº/g, 'ù')
                .replace(/â€™/g, "'").replace(/â€/g, '"')
                .replace(/â€œ/g, '"').replace(/â€ /g, '"')
                .replace(/lâ€™/g, "l'").replace(/dâ€™/g, "d'")
                .replace(/unâ€™/g, "un'").replace(/dellâ€™/g, "dell'")
                .replace(/â€“/g, '-').replace(/â€”/g, '-')
                .replace(/Ã/g, 'à')
                .replace(/\*\*/g, '').replace(/### /g, '').replace(/## /g, '').replace(/# /g, '');
            
            return clean.trim();
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

        console.log("[AI Proxy V37.4] Analisi Full Metadata per: " + filename);

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

        const promptSystem = "Identify this vinyl album. Return ONLY JSON with artist, title, genre, year, tracks, group_members, average_cost, condition, label, catalog_number, edition, notes, liner_notes. Clean Italian only (absolutely no markdown symbols like **).";

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
        return e.json(500, { error: "Backend Proxy Crash V37.4: " + err.message });
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
                .replace(/â€œ/g, '"').replace(/â€ /g, '"')
                .replace(/lâ€™/g, "l'").replace(/dâ€™/g, "d'")
                .replace(/unâ€™/g, "un'").replace(/dellâ€™/g, "dell'")
                .replace(/â€“/g, '-').replace(/â€”/g, '-')
                .replace(/Ã/g, 'à')
                .replace(/\*\*/g, '').replace(/### /g, '').replace(/## /g, '').replace(/# /g, '');
            return clean.trim();
        };

        let data = {};
        try { data = e.requestInfo().body || {}; } catch(err) {}
        
        const artist = data.artist;
        const title = data.title;
        const apiKey = data.apiKey;

        console.log("[AI Story V37.4] Story for: " + artist + " - " + title);

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
                    content: "Sei un esperto critico musicale. Scrivi una storia appassionante per questo album in ITALIANO. No markdown, solo testo pulito. Massimo 500 parole."
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
        return e.json(500, { error: "Story Proxy Crash V37.4: " + err.message });
    }
});

routerAdd("GET", "/api/music/search", (e) => {
    try {
        // Legge il parametro ?q= con più metodi di fallback per compatibilità con diverse versioni di PocketBase
        let query = "";
        try {
            // Metodo 1: URL diretta della request
            const rawUrl = e.request().url.toString();
            const urlMatch = rawUrl.match(/[?&]q=([^&]*)/);
            if (urlMatch) query = decodeURIComponent(urlMatch[1]);
        } catch(err) {}
        if (!query) {
            try {
                // Metodo 2: requestInfo().query come mappa Go
                const qMap = e.requestInfo().query;
                if (qMap && typeof qMap.get === "function") query = qMap.get("q") || "";
                else if (qMap && qMap.q) query = qMap.q;
            } catch(err) {}
        }
        if (!query) {
            try {
                // Metodo 3: queryParam nativo (PocketBase 0.22+)
                if (typeof e.queryParam === "function") query = e.queryParam("q") || "";
            } catch(err) {}
        }

        if (!query) return e.json(400, { error: "Missing query parameter" });

        console.log("[Music Proxy] Searching iTunes for: " + query);
        // We use entity=album to get full album data instead of individual tracks
        const res = $http.send({
            url: "https://itunes.apple.com/search?term=" + encodeURIComponent(query) + "&entity=album&limit=15",
            method: "GET",
            headers: {
                "User-Agent": "VinylCatalog/1.0 +http://localhost"
            }
        });

        const bytesToString = function(bytes) {
            if (!bytes) return "";
            if (typeof bytes === 'string') return bytes;
            let str = "";
            for (let i = 0; i < bytes.length; i++) {
                str += String.fromCharCode(bytes[i]);
            }
            return str;
        };

        const bodyStr = bytesToString(res.body);
        let body = {};
        try { body = JSON.parse(bodyStr); } catch (p) {}

        if (res.statusCode !== 200) {
            return e.json(res.statusCode, { error: "iTunes API Error", details: body });
        }

        // Map iTunes schema to a standard format for the frontend
        const mappedResults = (body.results || []).map(item => {
            // Upgrade artwork resolution from 100x100 to 600x600 for high quality
            let hiResImage = item.artworkUrl100 || "";
            if (hiResImage) {
                hiResImage = hiResImage.replace("100x100bb.jpg", "600x600bb.jpg");
            }
            
            return {
                title: item.collectionName || "Unknown Title",
                artist: item.artistName || "Unknown Artist",
                year: item.releaseDate ? item.releaseDate.substring(0, 4) : "",
                genre: item.primaryGenreName ? [item.primaryGenreName] : [],
                thumb: hiResImage,
                label: [item.copyright || ""],
                format: ["Digital / Vinyl"],
                id: item.collectionId
            };
        });

        return e.json(200, { results: mappedResults });
    } catch (err) {
        return e.json(500, { error: "Music Proxy Crash: " + err.message, stack: err.stack, name: err.name });
    }
});

routerAdd("GET", "/api/test-app", (e) => {
    const keys = Object.keys($app);
    const eKeys = Object.keys(e.app);
    return e.json(200, { appKeys: keys, eAppKeys: eKeys });
});

routerAdd("GET", "/api/publish", (e) => {
    try {
        console.log("[Publish] Starting GitHub Sync...");
        const GITHUB_TOKEN = "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";
        const REPO = "frasciarre98/Vinyl-app";
        const FILE_PATH = "src/data/vinyls-static.json";

        // Inline helpers (global scope not reliable in PocketBase JS VM)
        const _bytesToString = function(bytes) {
            if (!bytes) return "";
            if (typeof bytes === 'string') return bytes;
            let str = "";
            for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
            return str;
        };
        const _stringToBytes = function(str) {
            let bytes = [];
            for (let i = 0; i < str.length; i++) {
                const c = str.charCodeAt(i);
                if (c < 0x80) bytes.push(c);
                else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
                else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
            }
            return bytes;
        };
        const _b64 = function(bytes) {
            const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            const out = []; const l = bytes.length;
            for (let i = 0; i < l; i += 3) {
                const b0 = bytes[i], b1 = i+1<l?bytes[i+1]:0, b2 = i+2<l?bytes[i+2]:0;
                out.push(ch[b0>>2], ch[((b0&3)<<4)|(b1>>4)]);
                out.push(i+1<l ? ch[((b1&15)<<2)|(b2>>6)] : '=');
                out.push(i+2<l ? ch[b2&63] : '=');
            }
            return out.join('');
        };

        // 1. Get all records - Trial and error for Dao access
        let records = [];
        let dao = null;

        // Try different ways to find the Dao/App instance
        if (typeof $app !== 'undefined') {
            if (typeof $app.dao === 'function') dao = $app.dao();
            else if (typeof $app.Dao === 'function') dao = $app.Dao();
            else if ($app.dao) dao = $app.dao;
        }
        
        if (!dao && e.app) {
            if (typeof e.app.dao === 'function') dao = e.app.dao();
            else if (typeof e.app.Dao === 'function') dao = e.app.Dao();
            else if (e.app.dao) dao = e.app.dao;
        }

        if (!dao) {
            // Last resort: standard global $app search if the above failed
            try { records = $app.findRecordsByFilter("vinyls", "1=1", "", 1500); }
            catch(err) { throw new Error("Could not access database Dao: " + err.message); }
        } else {
            records = dao.findRecordsByFilter("vinyls", "1=1", "", 1500);
        }

        console.log("[Publish] Found " + records.length + " records.");
        
        const staticData = records.map(record => {
            // Get ID reliably
            const rid = record.id || (typeof record.getId === 'function' ? record.getId() : record.get("id"));
            const imageFile = record.getString("image") || "";
            // Match the naming convention used by export-static.js: /storage/{id}-{filename}
            const image_url = imageFile ? ("/storage/" + rid + "-" + imageFile) : null;
            
            return {
                id: rid,
                artist: record.getString("artist") || 'Unknown Artist',
                title: record.getString("title") || 'Unknown Album',
                genre: record.getString("genre") || '',
                year: record.getString("year") || '',
                format: record.getString("format") || 'Vinyl',
                label: record.getString("label") || '',
                catalog_number: record.getString("catalog_number") || '',
                edition: record.getString("edition") || '',
                tracks: record.getString("tracks") || '',
                group_members: record.getString("group_members") || '',
                notes: record.getString("notes") || '',
                condition: record.getString("condition") || 'N/A',
                liner_notes: record.getString("liner_notes") || '',
                rating: record.getInt("rating") || 0,
                purchase_price: record.getString("purchase_price") || '',
                purchase_year: record.getString("purchase_year") || '',
                average_cost: record.getString("average_cost") || record.getString("avarege_cost") || '',
                is_tracks_validated: record.getBool("is_tracks_validated"),
                is_price_locked: record.getBool("is_price_locked"),
                image_url: image_url,
                created: record.getString("created") || record.created,
                updated: record.getString("updated") || record.updated
            };
        });

        const jsonContent = JSON.stringify(staticData, null, 2);
        const base64Content = _b64(_stringToBytes(jsonContent));

        // 2. Get current SHA
        console.log("[Publish] Fetching current SHA from GitHub...");
        const getRes = $http.send({
            url: "https://api.github.com/repos/" + REPO + "/contents/" + FILE_PATH,
            method: "GET",
            headers: {
                "Authorization": "token " + GITHUB_TOKEN,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "VinylCatalog-Sync"
            }
        });

        let sha = "";
        if (getRes.statusCode === 200) {
            const bodyStr = _bytesToString(getRes.body);
            const body = JSON.parse(bodyStr);
            sha = body.sha;
            console.log("[Publish] Current SHA: " + sha);
        } else {
            console.log("[Publish] File not found or error (Status: " + getRes.statusCode + "). Proceeding without SHA.");
        }

        // 3. Push to GitHub
        console.log("[Publish] Pushing update to GitHub...");
        const putRes = $http.send({
            url: "https://api.github.com/repos/" + REPO + "/contents/" + FILE_PATH,
            method: "PUT",
            headers: {
                "Authorization": "token " + GITHUB_TOKEN,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "VinylCatalog-Sync",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: "🚀 Magic Sync from App (" + new Date().toISOString() + ")",
                content: base64Content,
                sha: sha,
                branch: "main"
            })
        });

        const putBody = _bytesToString(putRes.body);
        console.log("[Publish] GitHub Response: " + putRes.statusCode);

        if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
            return e.json(200, { success: true, message: "Sync complete! GitHub updated." });
        } else {
            return e.json(putRes.statusCode, { error: "GitHub Sync Failed", details: putBody });
        }

    } catch (err) {
        console.log("[Publish] CRASH: " + err.message);
        return e.json(500, { error: "Sync Crash: " + err.message });
    }
});
