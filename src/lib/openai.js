/**
 * Service to analyze album covers using AI (Google Gemini or OpenAI).
 */
// import { supabase } from './supabase'; // Removed

const DEFAULT_PROVIDER = 'gemini';
const MODEL_COOLDOWNS = new Map();

// --- CONFIGURATION MANAGEMENT ---

export function getProvider() {
    const stored = localStorage.getItem('ai_provider');
    if (stored) return stored;

    // Fallback to Env Vars
    if (import.meta.env.VITE_OPENAI_API_KEY) return 'openai';
    return DEFAULT_PROVIDER;
}

export function setProvider(provider) {
    localStorage.setItem('ai_provider', provider);
}

export function getApiKey(provider = null) {
    const current = provider || getProvider();
    if (current === 'openai') {
        return localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY;
    }
    return localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
}

export function saveApiKey(key, provider = 'gemini') {
    if (provider === 'openai') localStorage.setItem('openai_api_key', key);
    else localStorage.setItem('gemini_api_key', key);
}

export function getGeminiTier() {
    return localStorage.getItem('gemini_tier') || 'free';
}

export function setGeminiTier(tier) {
    localStorage.setItem('gemini_tier', tier);
}

// --- TESTING & VALIDATION ---
export async function testConnection(provider, apiKey) {
    if (!apiKey) throw new Error("No API Key provided");

    try {
        if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey.trim()}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: "Say 'OK'" }],
                    max_tokens: 5
                })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || response.statusText);
            }
            return true;
        } else {
            // Gemini Test
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Say OK" }] }]
                })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || response.statusText);
            }
            return true;
        }
    } catch (e) {
        throw e;
    }
}

// --- CORE ANALYSIS DISPATCHER ---

// Wrapper for Files (Upload Modal)
export async function analyzeImage(file, hint = null) {
    const base64Data = await fileToBase64(file);
    const base64Content = base64Data.split(',')[1];
    const mimeType = file.type || 'image/jpeg';

    // Resize is less critical here for single uploads but good practice
    // For now we pass raw file to provider-specific functions if they need it
    // But our Logic uses base64 strings.

    // We reuse the standard pipeline
    const provider = getProvider();
    const apiKey = getApiKey(provider);

    if (provider === 'openai') return analyzeOpenAI(base64Content, apiKey, hint, mimeType);
    return analyzeGemini(base64Content, mimeType, apiKey, hint);
}

// Wrapper for URLs (Batch Analysis)
export async function analyzeImageUrl(publicUrl, apiKey, hint = null) {
    try {
        // Append timestamp to bypass browser cache (fixes CORS issues if cached without headers)
        const fetchUrl = publicUrl + (publicUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        const response = await fetch(fetchUrl).catch(err => {
            throw new Error(`Could not access image. Possible CORS issue. \\nSolution: Check PocketBase file permissions.`);
        });
        if (!response.ok) throw new Error("Failed to download image from URL");

        const blob = await response.blob();

        // Resize image to prevent massive payload/memory freeze (CRITICAL)
        const resizedBase64 = await resizeImage(blob);
        const base64Content = resizedBase64.split(',')[1];

        const provider = getProvider();
        // If apiKey is passed, use it, otherwise fetch based on provider
        const keyToUse = apiKey || getApiKey(provider);

        if (provider === 'openai') return analyzeOpenAI(base64Content, keyToUse, hint, 'image/jpeg');
        return analyzeGemini(base64Content, 'image/jpeg', keyToUse, hint);

    } catch (error) {
        throw error;
    }
}

// --- PROVIDER IMPLEMENTATIONS ---

// 1. Google Gemini (Dynamic Discovery & Robust Cascade)
async function analyzeGemini(base64Content, mimeType, apiKey, hint = null) {
    if (!apiKey) throw new Error("Missing Gemini API Key");
    const cleanKey = apiKey.trim();

    // 1. Dynamic Discovery: Ask the API what models are available for this Key
    let availableModels = [];
    try {
        console.log("Fetching available Gemini models...");
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
        const listData = await listResponse.json();

        if (listData.models) {
            availableModels = listData.models
                .filter(m =>
                    m.supportedGenerationMethods &&
                    m.supportedGenerationMethods.includes('generateContent') &&
                    !m.name.toLowerCase().includes('gemma') && // Exclude Gemma (No JSON mode)
                    !m.name.endsWith('/gemini-pro') &&  // Exclude Deprecated 1.0 Pro (404s)
                    !m.name.includes('gemini-1.0') &&   // Exclude Legacy 1.0 Series
                    !m.name.includes('8b')              // Exclude Unstable 8b Models
                )
                .map(m => m.name.replace('models/', ''));

            console.log("Discovered Models:", availableModels);
        }
    } catch (e) {
        console.warn("Failed to list models, falling back to hardcoded list:", e);
    }

    // 2. Prioritize: Valid Discovered Models OR Hardcoded Backup
    const isPaid = getGeminiTier() === 'paid';
    const modelPref = localStorage.getItem('gemini_model') || 'auto';

    // Model Mapping
    const MAP = {
        'flash': 'gemini-1.5-flash',
        'pro': 'gemini-1.5-pro',
        'flash-2': 'gemini-2.0-flash-exp'
    };

    // For Paid Users: Prioritize STABLE, HIGH-THROUGHPUT models
    const PAID_ORDER = [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp'
    ];

    const FREE_ORDER = [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp'
    ];

    let PREFERRED_ORDER = isPaid ? PAID_ORDER : FREE_ORDER;

    // MANUAL OVERRIDE (User Preference)
    if (modelPref !== 'auto' && MAP[modelPref]) {
        const forced = MAP[modelPref];
        console.log(`Applying Manual Model Preference: ${forced}`);
        // Move forced model to front, keeping unique
        PREFERRED_ORDER = [forced, ...PREFERRED_ORDER.filter(m => m !== forced)];
    }

    let candidateModels = [];

    // Logic: If we found models dynamically, pick the best ones from that list.
    // Otherwise use our hardcoded preference list.
    if (availableModels.length > 0) {
        // Sort available models by our preference order
        candidateModels = availableModels.sort((a, b) => {
            const indexA = PREFERRED_ORDER.findIndex(p => a.includes(p));
            const indexB = PREFERRED_ORDER.findIndex(p => b.includes(p));
            // If both are in our list, lower index wins. If one is missing, it goes to end.
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });
    } else {
        candidateModels = PREFERRED_ORDER;
    }

    // CRITICAL FAILSAFE: Never allow empty list
    if (candidateModels.length === 0) {
        console.warn("No models found or configured. Forcing fallback to 1.5 Flash.");
        candidateModels = ['gemini-1.5-flash', 'gemini-1.5-pro'];
    }

    // CIRCUIT BREAKER FILTER
    const now = Date.now();
    candidateModels = candidateModels.filter(m => {
        const expiry = MODEL_COOLDOWNS.get(m);
        if (expiry && now < expiry) {
            console.log(`Skipping Cooled-down Model: ${m} (Active for ${Math.round((expiry - now) / 1000)}s)`);
            return false;
        }
        return true;
    });

    // CRITICAL FAILSAFE: Never allow empty list (If all cooled down, force retry on preferred)
    if (candidateModels.length === 0) {
        console.warn("All models in cooldown. Forcing reset and retry.");
        MODEL_COOLDOWNS.clear();
        candidateModels = PREFERRED_ORDER;
    }

    console.log("Attempting Cascade:", candidateModels);

    let lastError = null;

    for (const model of candidateModels) {
        try {
            console.log(`Trying Gemini Model: ${model}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `Identify this vinyl album. ${hint ? `The user states this is: '${hint}'. Verify this against the cover image.` : 'Identify the album from the artwork.'}
Once identified, use your internal knowledge (Discogs/MusicBrainz) to fill in the metadata. 
**CRITICAL FOR ACCURACY:**
- **VISUAL MATCHING:** Look at the back cover image. Read 2-3 unique track titles you see. Use these to find the **EXACT Edition** in your database that matches this specific tracklist.
- If the image contains a tracklist, **TRUST THE IMAGE** over the standard album version.
- If this is a Compilation, ensure the tracklist matches what is printed on the cover.
Return JSON with these keys: 
- artist
- title
- genre
- year (original release)
- tracks (full list, newline separated)
- group_members (key members, comma separated)
- average_cost (e.g. "€20-30")
- condition (visual estimate: Good/Fair/Mint)
- label (Record Label, e.g. "Blue Note", "Columbia")
- catalog_number (Catalog ID on spine/back, e.g. "PCS 7027")
- edition (e.g. "1st Press", "Reissue", "Red Vinyl", "Japanese Import")
- notes (Detailed description including: history of the album/artist, interesting anecdotes, trivia, recording context, and musical influence. Make it engaging and comprehensive approx 300-500 words)
Raw JSON only.` },
                            { inline_data: { mime_type: mimeType, data: base64Content } }
                        ]
                    }],
                    generationConfig: {
                        response_mime_type: "application/json",
                        temperature: 0
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || response.statusText;

                // 404 (Not Found) OR 429 (Quota Limit) -> Try Next Model
                if (response.status === 404 || response.status === 429 ||
                    errMsg.includes("not found") || errMsg.includes("not supported") ||
                    errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit")) {

                    console.warn(`Model ${model} issue: ${errMsg}. Trying next model...`);

                    // Trigger Circuit Breaker for Rate Limits
                    if (response.status === 429 || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit")) {
                        MODEL_COOLDOWNS.set(model, Date.now() + 60000);
                    }

                    lastError = new Error(errMsg);
                    continue;
                }
                throw new Error(errMsg); // Critical errors (Auth, BadRequest)
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Empty response from AI");

            console.log(`✓ Success with model: ${model}`);
            return parseAIResponse(text);

        } catch (error) {
            console.warn(`Model ${model} failed execution:`, error.message);
            lastError = error;

            // If it's a Limit/Quota error from fetch throw, Continue to next model
            if (error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("limit") || error.message.includes("429")) {
                MODEL_COOLDOWNS.set(model, Date.now() + 60000);
                continue;
            }

            if (error.message.includes("API Key")) throw error;
        }
    }

    throw new Error(`All models failed. Last error: ${lastError?.message || 'Check API Key permissions'}`);
}

// 2. OpenAI (GPT-4o - Expert & Precise)
async function analyzeOpenAI(base64Content, apiKey, hint = null, mimeType = 'image/jpeg') {
    if (!apiKey) throw new Error("Missing OpenAI API Key");

    const cleanKey = apiKey.trim();

    try {
        console.log(`[OpenAI] Sending request... (Hint: ${hint}, Mime: ${mimeType})`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert musicologist and archivist.
Your goal is to provide **Forensic Level Metadata**.
1. **Back Cover (Visual Truth):** If you see a tracklist, you are a SCANNER. Transcribe text EXACTLY as printed (including typos, e.g. "Liberi di- liberida"). Do not correct it.
2. **Front Cover (Database Truth):** If using the database, finding the **Italian First Pressing** is mandatory for Italian artists. 
   - For "Dirotta su Cuba", look for the 1994 CGD release.
   - For "Formula 3", look for the original Numero Uno release.
   - Do NOT use CD reissues with bonus tracks.`
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

Return JSON keys: artist, title, genre, year, tracks, group_members, average_cost, condition, label, catalog_number, edition, notes (Concise summary, max 100 words).` },
                            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Content}`, detail: "high" } }
                        ]
                    }
                ],

                response_format: { type: "json_object" },
                max_tokens: 3000,
                temperature: 0.1
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("[OpenAI] API Error:", data.error);
            throw new Error(data.error.message);
        }

        const choice = data.choices[0];
        if (!choice.message.content) {
            console.error("[OpenAI] Empty Response. Full Choice:", JSON.stringify(choice, null, 2));
            if (choice.message.refusal) {
                throw new Error(`OpenAI Refusal: ${choice.message.refusal}`);
            }
            throw new Error(`OpenAI returned empty content. Reason: ${choice.finish_reason}`);
        }

        // Check for truncation
        if (choice.finish_reason === 'length') {
            throw new Error("AI Response Truncated. Try reducing image complexity or prompt length.");
        }

        console.log("[OpenAI] Raw Response:", choice.message.content); // CRITICAL DEBUG LOG
        return parseAIResponse(choice.message.content);

    } catch (error) {
        console.error("[OpenAI] Exception:", error);
        throw error;
    }
}


// --- HELPERS ---

function parseAIResponse(jsonString) {
    if (!jsonString) throw new Error("Empty AI response");

    let content = jsonString.trim();

    // 1. Strip Markdown Code Blocks
    // Remove ```json ... ``` or just ``` ... ```
    // We use a multi-step replacement to ensure we catch the start and end cleanly
    content = content.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');

    // 2. Locate the outermost JSON object bounds
    const firstOpen = content.indexOf('{');
    const lastClose = content.lastIndexOf('}');

    // HANDLING TRUNCATION:
    // If we have a start '{' but missing '}' (or it's before the start),
    // we attempt to REPAIR it instead of throwing.
    if (firstOpen !== -1 && (lastClose === -1 || lastClose < firstOpen)) {
        console.warn("JSON Truncated. Attempting Auto-Repair...");
        try {
            // Take everything from the first bracket
            const incomplete = content.substring(firstOpen);
            const repaired = repairBrokenJSON(incomplete);
            console.log("Repaired JSON:", repaired);
            return normalizeParsedData(JSON.parse(repaired));
        } catch (repairErr) {
            console.error("Auto-Repair Failed:", repairErr);
            throw new Error(`JSON Truncated & Irreparable: ${repairErr.message}`);
        }
    }

    if (firstOpen === -1) {
        throw new Error(`AI returned text, not JSON: "${content.substring(0, 50)}..."`);
    }

    // Isolate the candidate string
    let candidate = content.substring(firstOpen, lastClose + 1);

    // 3. Attempt Parsing with progressive fallback sanitization
    try {
        return normalizeParsedData(JSON.parse(candidate));
    } catch (e1) {
        // Error? Common cause: Newlines in strings.
        // Attempt to fix: Replace literal newlines inside the string with \n
        // (This is a naive regex but catches the most common "Notes" field issue)
        try {
            const sanitized = candidate.replace(/\n/g, "\\n").replace(/\r/g, "");
            return normalizeParsedData(JSON.parse(sanitized));
        } catch (e2) {
            // Still failing?
            console.error("JSON PARSE FAILED. Raw:", candidate);
            // Throw a specific error with the start of the content so the user can report it
            // We truncate it to fit in the toast
            throw new Error(`JSON Syntax Error: ${e1.message}.`);
        }
    }
}

/**
 * Tries to close a truncated JSON string by appending missing quotes and braces.
 */
function repairBrokenJSON(json) {
    let repaired = json;

    // 1. Check if inside a string (Odd number of quotes, ignoring escaped ones)
    // We count quotes from the start. 
    // Note: This is a simplified check.
    let quoteCount = 0;
    let escape = false;
    for (let c of repaired) {
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') quoteCount++;
    }

    if (quoteCount % 2 !== 0) {
        // We are inside a string. Close it.
        repaired += '"';
    }

    // 2. Count Braces and Brackets to close them
    // Reset parser state to scan the (possibly string-closed) content
    let depthBrace = 0; // {}
    let depthBracket = 0; // []
    let inString = false;
    escape = false;

    for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i];
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }

        if (c === '"') { inString = !inString; continue; }

        if (!inString) {
            if (c === '{') depthBrace++;
            else if (c === '}') depthBrace--;
            else if (c === '[') depthBracket++;
            else if (c === ']') depthBracket--;
        }
    }

    // Append missing closing brackets/braces in reverse order of likelihood (usually close stack)
    // Ideally we'd track a stack, but simplistic counting works for trailing truncation.
    // Close arrays first (inner), then objects.
    while (depthBracket > 0) {
        repaired += ']';
        depthBracket--;
    }
    while (depthBrace > 0) {
        repaired += '}';
        depthBrace--;
    }

    return repaired;
}

function normalizeParsedData(parsed) {
    if (!parsed) return {};
    return {
        artist: parsed.artist || "Unknown",
        title: parsed.title || "Unknown",
        genre: parsed.genre || "Unknown",
        year: parsed.year ? String(parsed.year) : "",
        group_members: Array.isArray(parsed.group_members) ? parsed.group_members.join(', ') : (parsed.group_members || ""),
        tracks: Array.isArray(parsed.tracks) ? parsed.tracks.join('\n') : (parsed.tracks || ""),
        condition: parsed.condition || "Good",
        average_cost: parsed.average_cost || "",
        label: parsed.label || "",
        catalog_number: parsed.catalog_number || "",
        edition: parsed.edition || "",
        notes: parsed.notes || parsed.note || "Analyzed by AI"
    };
}

// Helper to resize image using Canvas (Memory Optimized)
export function resizeImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(fileOrBlob);
        const img = new Image();
        img.src = url;

        img.crossOrigin = 'Anonymous'; // Check for CORS
        img.onload = () => {
            try {
                const maxWidth = 2048;
                const maxHeight = 2048;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Release source memory immediately
                URL.revokeObjectURL(url);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(new Error("Image processing failed: " + e.message));
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Image load failed"));
        };
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
