/**
 * Service to analyze album covers using AI (Google Gemini or OpenAI).
 */
// import { supabase } from './supabase'; // Removed

const DEFAULT_PROVIDER = 'gemini';
const MODEL_COOLDOWNS = new Map();

// --- CONFIGURATION MANAGEMENT ---

export function getProvider() {
    return localStorage.getItem('ai_provider') || DEFAULT_PROVIDER;
}

export function setProvider(provider) {
    localStorage.setItem('ai_provider', provider);
}

export function getApiKey(provider = null) {
    const current = provider || getProvider();
    if (current === 'openai') return localStorage.getItem('openai_api_key');
    return localStorage.getItem('gemini_api_key');
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
export async function analyzeImage(file) {
    const base64Data = await fileToBase64(file);
    const base64Content = base64Data.split(',')[1];
    const mimeType = file.type || 'image/jpeg';

    // Resize is less critical here for single uploads but good practice
    // For now we pass raw file to provider-specific functions if they need it
    // But our Logic uses base64 strings.

    // We reuse the standard pipeline
    const provider = getProvider();
    const apiKey = getApiKey(provider);

    if (provider === 'openai') return analyzeOpenAI(base64Content, apiKey);
    return analyzeGemini(base64Content, mimeType, apiKey);
}

// Wrapper for URLs (Batch Analysis)
export async function analyzeImageUrl(publicUrl, apiKey, hint = null) {
    try {
        // Append timestamp to bypass browser cache (fixes CORS issues if cached without headers)
        const fetchUrl = publicUrl + (publicUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        const response = await fetch(fetchUrl).catch(err => {
            throw new Error(`Could not access image. Possible CORS issue. \nSolution: Add "${window.location.hostname}" as a Web Platform in Appwrite Console.`);
        });
        if (!response.ok) throw new Error("Failed to download image from URL");

        const blob = await response.blob();

        // Resize image to prevent massive payload/memory freeze (CRITICAL)
        const resizedBase64 = await resizeImage(blob);
        const base64Content = resizedBase64.split(',')[1];

        const provider = getProvider();
        // If apiKey is passed, use it, otherwise fetch based on provider
        const keyToUse = apiKey || getApiKey(provider);

        if (provider === 'openai') return analyzeOpenAI(base64Content, keyToUse, hint);
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
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp'
    ];

    const FREE_ORDER = [
        'gemini-2.0-flash-exp', // Try latest first
        'gemini-1.5-flash',
        'gemini-1.5-pro'
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
                            { text: `Act as an expert musicologist and vinyl appraiser. Identify this album cover. Use your internal knowledge (Discogs, MusicBrainz, Wikipedia) to provide precise metadata. Return JSON with keys: artist, title, genre, year (original release), tracks (full list, newline separated), group_members (comma separated list of key members), average_cost (realistic market value estimate in EUR based on median resale prices, e.g. "€20-30"), condition (visual estimate: Good/Fair/Mint), notes (interesting trivia/facts, max 500 chars). Do NOT use Markdown. Raw JSON only.${hint ? ` IMPORTANT: The user explicitly identifies this album as '${hint}'. TRUST THIS IDENTIFICATION. Use your internal knowledge to fetch details for '${hint}'.` : ''}` },
                            { inline_data: { mime_type: mimeType, data: base64Content } }
                        ]
                    }],
                    generationConfig: { response_mime_type: "application/json" }
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

// 2. OpenAI (GPT-4o-mini - Fast & Cheap)
async function analyzeOpenAI(base64Content, apiKey, hint = null) {
    if (!apiKey) throw new Error("Missing OpenAI API Key");

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { text: `Act as an expert musicologist and vinyl appraiser. Identify this album cover. Use your internal knowledge (Discogs, MusicBrainz, Wikipedia) to provide precise metadata. Return JSON with keys: artist, title, genre, year (original release), tracks (full list, newline separated), group_members (comma separated list of key members), average_cost (realistic market value estimate in EUR based on median resale prices, e.g. "€20-30"), condition (visual estimate: Good/Fair/Mint), notes (interesting trivia/facts, max 500 chars). Do NOT use Markdown. Raw JSON only.${hint ? ` IMPORTANT: The user explicitly identifies this album as '${hint}'. TRUST THIS IDENTIFICATION. Use your internal knowledge to fetch details for '${hint}'.` : ''}` },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Content}`, detail: "low" } }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 300
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const text = data.choices[0].message.content;
        return parseAIResponse(text);

    } catch (error) {
        console.error("OpenAI Error:", error);
        throw error;
    }
}


// --- HELPERS ---

function parseAIResponse(jsonString) {
    let content = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        // Simple repair attempt
        const match = content.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Invalid JSON from AI");
    }

    return {
        artist: parsed.artist || "Unknown",
        title: parsed.title || "Unknown",
        genre: parsed.genre || "Unknown",
        year: parsed.year ? String(parsed.year) : "",
        group_members: Array.isArray(parsed.group_members) ? parsed.group_members.join(', ') : (parsed.group_members || ""),
        tracks: Array.isArray(parsed.tracks) ? parsed.tracks.join('\n') : (parsed.tracks || ""),
        condition: parsed.condition || "Good",
        average_cost: parsed.average_cost || "",
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
                const maxWidth = 800;
                const maxHeight = 800;
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
