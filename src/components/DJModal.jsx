import React, { useState, useEffect } from 'react';
import { X, Headphones, Disc, PlayCircle, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { pb } from '../lib/pocketbase';

export function DJModal({ isOpen, onClose }) {
    const [step, setStep] = useState(1); // 1: Input, 2: Loading, 3: Results
    const [mood, setMood] = useState("");
    const [customMood, setCustomMood] = useState("");
    const [format, setFormat] = useState("Tutti");
    const [loadingMsg, setLoadingMsg] = useState("");
    const [recommendations, setRecommendations] = useState([]);
    
    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setMood("");
            setCustomMood("");
            setFormat("Tutti");
            setRecommendations([]);
        }
    }, [isOpen]);

    const handlePlay = async (recordId) => {
        try {
            const record = await pb.collection('vinyls').getOne(recordId);
            const currentCount = record.play_count || 0;
            await pb.collection('vinyls').update(recordId, {
                last_played: new Date().toISOString(),
                play_count: currentCount + 1
            });
            // Update local state to reflect UI
            setRecommendations(prev => prev.map(r => r.id === recordId ? { ...r, played: true } : r));
        } catch (e) {
            console.error(e);
            alert("Errore durante l'aggiornamento dell'ascolto.");
        }
    };

    const startDJ = async () => {
        const finalMood = customMood.trim() !== "" ? customMood : mood;
        if (!finalMood) {
            alert("Seleziona uno stato d'animo o scrivi una richiesta!");
            return;
        }

        setStep(2);
        setLoadingMsg("Esploro la tua collezione...");

        try {
            // Get user settings for API key
            const provider = localStorage.getItem('ai_provider') || 'gemini';
            const apiKey = provider === 'gemini' 
                ? localStorage.getItem('gemini_api_key') 
                : localStorage.getItem('openai_api_key');

            if (!apiKey) {
                alert("Devi prima inserire una API Key (Gemini o OpenAI) nelle Impostazioni!");
                setStep(1);
                return;
            }

            // Fetch collection
            const allRecords = await pb.collection('vinyls').getFullList();
            
            // Format for AI (to save tokens, just send a minimal string)
            // ID | Artist | Title | Genre | Last Played
            const collectionStr = allRecords.map(r => {
                const lp = r.last_played ? new Date(r.last_played).toLocaleDateString() : "Mai";
                return `${r.id} | ${r.artist} | ${r.title} | ${r.genre || 'Sconosciuto'} | ${r.format || 'Sconosciuto'} | ${lp}`;
            }).join('\n');

            setLoadingMsg("L'Intelligenza Artificiale sta scegliendo...");

            const timeContext = new Date().toLocaleString('it-IT', { weekday: 'long', hour: 'numeric', minute: 'numeric' });

            const payload = {
                apiKey,
                provider,
                mood: finalMood,
                timeContext,
                formatFilter: format,
                collection: collectionStr
            };

            const res = await pb.send('/api/ai-dj', {
                method: 'POST',
                body: payload
            });

            if (res && res.recommendations) {
                // Map recommendations back to full record objects for UI
                const enriched = res.recommendations.map(rec => {
                    const fullRecord = allRecords.find(r => r.id === rec.id);
                    return {
                        ...rec,
                        record: fullRecord,
                        played: false
                    };
                }).filter(r => r.record); // keep only valid matches

                setRecommendations(enriched);
                setStep(3);
            } else {
                throw new Error("Formato di risposta AI non valido");
            }

        } catch (err) {
            console.error(err);
            alert("Errore del DJ: " + (err.data?.error || err.message));
            setStep(1);
        }
    };

    const moodPresets = [
        "⚡️ Energico", "🍷 Rilassato", "🌧️ Malinconico", 
        "🎸 Voglia di Rock", "🕺 Da Ballare", "☕️ Domenica Mattina"
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-xl max-w-4xl w-full max-h-[90vh] border border-indigo-500/30 shadow-2xl flex flex-col">
                
                {/* HEADER */}
                <div className="flex items-center justify-between p-6 border-b border-indigo-500/20">
                    <div className="flex items-center gap-3 text-indigo-400">
                        <Headphones className="w-6 h-6" />
                        <h2 className="text-xl font-bold text-white">DJ Virtuale</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* BODY */}
                <div className="p-6 flex-1 overflow-y-auto">
                    
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-bold text-white">Cosa vuoi ascoltare?</h3>
                                <p className="text-slate-400">Il tuo Sommelier Musicale analizzerà la tua intera collezione e sceglierà 4 dischi perfetti per questo momento.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium text-slate-300">1. Scegli un Vibe...</label>
                                <div className="flex flex-wrap gap-3">
                                    {moodPresets.map(m => (
                                        <button
                                            key={m}
                                            onClick={() => { setMood(m); setCustomMood(""); }}
                                            className={`px-4 py-2 rounded-full border transition-all ${
                                                mood === m && customMood === ""
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500/50'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium text-slate-300">...Oppure descrivi la situazione:</label>
                                <input
                                    type="text"
                                    placeholder="Es: Ospiti a cena eleganti, sto cucinando, voglio sorprendermi..."
                                    value={customMood}
                                    onChange={(e) => { setCustomMood(e.target.value); setMood(""); }}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium text-slate-300">Formato Preferito:</label>
                                <div className="flex gap-4">
                                    {['Tutti', 'Vinile', 'CD'].map(f => (
                                        <label key={f} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="format" 
                                                checked={format === f} 
                                                onChange={() => setFormat(f)}
                                                className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600"
                                            />
                                            {f}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={startDJ}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-indigo-900/50"
                            >
                                <Sparkles className="w-5 h-5" />
                                Lasciati Ispirare
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                <Disc className="w-16 h-16 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
                            </div>
                            <h3 className="text-xl font-medium text-white">{loadingMsg}</h3>
                            <p className="text-slate-400 text-sm">Controllo le tue abitudini d'ascolto e i grandi classici...</p>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Ecco la Selezione del Sommelier</h3>
                                <button onClick={() => setStep(1)} className="text-sm flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                                    <RefreshCw className="w-4 h-4" /> Riprova
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {recommendations.map((rec, i) => {
                                    const r = rec.record;
                                    const imgUrl = r.image ? pb.files.getUrl(r, r.image, { thumb: '400x400' }) : null;
                                    
                                    return (
                                        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col transition-all hover:border-indigo-500/50">
                                            <div className="flex gap-4 p-4">
                                                <div className="w-24 h-24 flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                                                    {imgUrl ? (
                                                        <img src={imgUrl} alt={r.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Disc className="w-8 h-8 text-slate-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-lg font-bold text-white truncate">{r.title}</h4>
                                                    <p className="text-indigo-400 font-medium truncate">{r.artist}</p>
                                                    <div className="mt-2 flex gap-2 text-xs">
                                                        <span className="px-2 py-1 bg-slate-900 rounded-full text-slate-300">{r.format || 'Vinile'}</span>
                                                        <span className="px-2 py-1 bg-slate-900 rounded-full text-slate-300">{r.genre || 'Vari'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex-1">
                                                <p className="text-slate-300 text-sm italic leading-relaxed text-pretty">
                                                    "{rec.reason}"
                                                </p>
                                            </div>
                                            
                                            <div className="p-4 pt-0 bg-slate-900/50">
                                                <button 
                                                    onClick={() => handlePlay(r.id)}
                                                    disabled={rec.played}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${
                                                        rec.played 
                                                        ? 'bg-emerald-500/20 text-emerald-400 cursor-not-allowed'
                                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                                    }`}
                                                >
                                                    {rec.played ? (
                                                        <>✔ Ascoltato oggi</>
                                                    ) : (
                                                        <>
                                                            <PlayCircle className="w-5 h-5" />
                                                            Mettilo sul Piatto!
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
