console.log(">>> MAGIC HOOK LOADED (Universal V36.1): " + new Date().toISOString());

routerAdd("POST", "/api/custom-ai-analyze", (e) => {
    try {
        // --- HIGH PERFORMANCE BASE64 ENCODER (V34.2+) ---
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

        const bytesToString = function(bytes) {
            if (!bytes) return "";
            if (typeof bytes === 'string') return bytes;
            let str = "";
            for (let i = 0; i < bytes.length; i++) {
                str += String.fromCharCode(bytes[i]);
            }
            return str;
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
        const filename = data.filename;
        const apiKey = data.apiKey;
        const provider = (data.provider || "openai").toLowerCase();
        const collectionId = data.collectionId || "vinyls";
        const hint = data.hint || "";
        const base64Override = data.base64Override;

        console.log("[AI Proxy V36.1] Analisi Full Metadata per: " + filename + " (Coll: " + collectionId + ")");

        if (!filename || !apiKey) {
            return e.json(400, { error: "Missing required data (Filename or API Key)" });
        }

        // --- ENCODING STRATEGY (V36.1 Hybrid) ---
        let base64Content = "";
        
        if (base64Override) {
            // Case A: Browser already converted the image (e.g. iPhone HEIC -> JPEG)
            console.log("[AI Proxy V36.1] Using provided Base64 override (Browser conversion)");
            base64Content = base64Override;
        } else {
            // Case B: Standard file. Read directly from NAS disk for maximum speed.
            if (!recordId) return e.json(400, { error: "Missing RecordID for disk read" });
            
            console.log("[AI Proxy V36.1] Reading file from disk: " + filename);
            
            // Try Dynamic Path first, then fallback to "vinyls"
            let filePath = "/pb/pb_data/storage/" + collectionId + "/" + recordId + "/" + filename;
            let fileBytes;
            
            try {
                fileBytes = $os.readFile(filePath);
            } catch (pathErr) {
                console.warn("[AI Proxy V36.1] Primary path failed (" + collectionId + "), trying fallback 'vinyls'...");
                filePath = "/pb/pb_data/storage/vinyls/" + recordId + "/" + filename;
                fileBytes = $os.readFile(filePath);
            }
            
            try {
                if (typeof $security !== 'undefined' && $security.base64Encode) {
                    base64Content = $security.base64Encode(fileBytes);
                } else if (typeof $security !== 'undefined' && $security.base64_encode) {
                    base64Content = $security.base64_encode(fileBytes);
                } else {
                    throw new Error("Native helper missing");
                }
            } catch (f) {
                base64Content = optimizedBase64Encode(fileBytes);
            }
        }
        
        // --- MIME & COMPATIBILITY CHECK ---
        const ext = filename.split('.').pop().toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === "png") mimeType = "image/png";
        else if (ext === "webp") mimeType = "image/webp";
        else if (ext === "heic" || ext === "heif") mimeType = "image/heic";

        // CRITICAL: If still HEIC at this stage (conversion failed), warn about OpenAI
        if (mimeType === "image/heic" && provider === "openai") {
            const errMsg = "[V36.1] Formato Apple HEIC non supportato da OpenAI. La conversione nel browser è fallita o non è stata eseguita.";
            console.warn("[AI Proxy V36.1] " + errMsg);
            return e.json(400, { error: errMsg });
        }

        const headers = { "Content-Type": "application/json" };
        if (provider !== "gemini") {
            headers["Authorization"] = "Bearer " + apiKey;
        }

        const promptSystem = "Identify this vinyl album. Return ONLY JSON with artist, title, genre, year, tracks, group_members, average_cost, condition, label, catalog_number, edition, notes, liner_notes. " +
                           "IMPORTANT: Provide numeric average_cost if possible. Clean output only.";

        console.log("[AI Proxy V36.1] Sending to " + provider + " (MIME: " + mimeType + ")");

        const aiRes = $http.send({
            url: provider === "gemini" ? 
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey :
                "https://api.openai.com/v1/chat/completions",
            method: "POST",
            body: JSON.stringify(provider === "gemini" ? {
                contents: [{ parts: [{ text: promptSystem + (hint ? " User states: '" + hint + "'." : "") }, { inlineData: { mimeType: mimeType, data: base64Content } }] }]
            } : {
                model: "gpt-4o",
                messages: [{ role: "user", content: [
                    { type: "text", text: promptSystem + (hint ? " User states: '" + hint + "'." : "") },
                    { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64Content } }
                ]}],
                response_format: { type: "json_object" }
            }),
            headers: headers
        });

        const responseBodyStr = bytesToString(aiRes.body);

        if (aiRes.statusCode !== 200) {
            console.error("[AI Proxy V36.1] AI API Error: " + responseBodyStr);
            return e.json(aiRes.statusCode, { error: "AI Provider Error: " + responseBodyStr });
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

        const sanitize = (val, max) => String(val || '').substring(0, max);
        
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
        console.error("[AI Proxy V36.1] CRASH: " + err);
        return e.json(500, { error: "Backend Proxy Crash V36.1: " + err.message });
    }
});
