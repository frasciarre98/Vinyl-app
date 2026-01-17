import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, CheckCircle, Disc, AlertCircle, Wand2, Loader2, Sparkles as LucideSparkles, PlayCircle, Youtube } from 'lucide-react';
import { databases, DATABASE_ID } from '../lib/appwrite';
import { analyzeImageUrl, getApiKey } from '../lib/openai';

export const VinylCard = React.memo(function VinylCard({ vinyl, onDelete, onEdit, selectionMode, isSelected, onToggleSelect, isFlipped, onFlip, onViewDetail }) {
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    // Local state to show updates immediately without full grid refresh
    const [localVinyl, setLocalVinyl] = useState(vinyl);

    useEffect(() => {
        setLocalVinyl(vinyl);
    }, [vinyl]);

    // ... handleAnalyze ...
    const isPending = localVinyl.artist === 'Pending AI' || localVinyl.artist === 'Error';
    const isActiveAnalysis = localVinyl.artist === 'Pending AI';

    const handleAnalyze = async (e) => {
        e.stopPropagation();

        // Guided AI: If already analyzed (or has title), ask for hint
        let hint = null;
        if (!isActiveAnalysis && (localVinyl.title || localVinyl.artist)) {
            const userInput = prompt("Guided Analysis: Help the AI by entering the Artist and Album Name (e.g., 'Pink Floyd - Animals').\n\nLeave empty to run standard analysis.");
            if (userInput === null) return; // Cancelled
            if (userInput.trim()) hint = userInput.trim();
        }

        setAnalyzing(true);
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                alert("Please set your Gemini API Key in settings first.");
                return;
            }

            const analysis = await analyzeImageUrl(localVinyl.image_url, apiKey, hint);

            // Update Appwrite
            // Update Supabase (Adaptive: Try Full, Fallback to Basic)
            const fullUpdate = {
                artist: analysis.artist,
                title: analysis.title,
                genre: analysis.genre,
                year: String(analysis.year || '').substring(0, 50),
                notes: String(analysis.notes || '').substring(0, 999),
                group_members: String(analysis.group_members || '').substring(0, 999),
                condition: analysis.condition,
                // Sanitise cost to strict String(50)
                avarege_cost: String(analysis.average_cost || '').substring(0, 50),
                tracks: String(analysis.tracks || '').substring(0, 4999)
            };

            // CRITICAL: Respect User Validation
            if (localVinyl.is_tracks_validated) {
                console.log("Preserving validated tracks for:", localVinyl.title);
                delete fullUpdate.tracks;
            }

            // Try Full Update - If this fails, it means Schema is missing attributes in Appwrite.
            // We want to know WHICH one failed validation.
            try {
                await databases.updateDocument(
                    DATABASE_ID,
                    'vinyls',
                    localVinyl.id,
                    fullUpdate
                );
            } catch (fullError) {
                console.error("APPWRITE UPDATE FAILED:", fullError);
                // Alert the user so they see it
                alert(`Update Failed: ${fullError.message}. Check if 'average_cost', 'tracks', or 'group_members' exist in Appwrite Database Attributes.`);
                throw fullError;
            }

            // Update local view
            setLocalVinyl(prev => ({ ...prev, ...analysis }));
            alert(hint ? "Guided Analysis Complete!" : "Analysis Complete!");

        } catch (err) {
            console.error("Analysis failed:", err);
            // Explicitly alert the user to the failure reason (e.g. API Key missing or Quota)
            alert(`Analysis Failed: ${err.message} `);

            const msg = err.message.toLowerCase();
            if (msg.includes("quota") || msg.includes("limit") || msg.includes("429")) {
                setError("Limit hit. Wait 30s.");
            } else {
                setError("Error. Try again.");
            }
        } finally {
            setAnalyzing(false);
        }
    };

    // ... rest of component ...

    return (
        <div
            className={`
                group relative w-full h-0 pb-[100%] md:h-[320px] md:pb-0 perspective-1000
                ${selectionMode ? 'cursor-pointer' : 'cursor-zoom-in'}
                ${isFlipped ? 'z-50' : 'z-0'}
`}
            onClick={() => {
                if (selectionMode) onToggleSelect(vinyl.id);
                else {
                    // Mobile Overhaul: Prefer detail view modal over flip
                    if (onViewDetail) onViewDetail();
                    else onFlip();
                }
            }}
        >
            {/* ... JSX ... */}
            {selectionMode && (
                <div className={`absolute top-3 left-3 z-30 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-black/50 border-white/50'}`}>
                    {isSelected && <CheckCircle className="w-4 h-4 text-black" />}
                </div>
            )}

            <div className={`absolute inset-0 md:relative md:inset-auto md:w-full md:h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

                {/* FRONT FACE - FULL COVER ART */}
                <div className="absolute inset-0 backface-hidden bg-black border border-white/10 rounded-xl overflow-hidden shadow-xl group-hover:shadow-2xl transition-all duration-300">

                    {/* Full Image */}
                    {localVinyl.image_url ? (
                        <div className="w-full h-full relative">
                            <img
                                src={localVinyl.image_url}
                                alt={`${localVinyl.artist} - ${localVinyl.title} `}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                loading="lazy"
                            />
                            {/* Gradient Overlay for Text */}
                            <div className="hidden md:flex absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4 flex-col justify-end min-h-[40%] translate-y-2 group-hover:translate-y-0 transition-transform">
                                <h3 className="font-bold text-white truncate text-lg leading-tight dropshadow-md">{localVinyl.title || 'Unknown Album'}</h3>
                                <p className="text-gray-300 truncate text-sm font-medium flex items-center gap-2">
                                    {localVinyl.artist === 'Pending AI' ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</> : (localVinyl.artist || 'Unknown Artist')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 relative">
                            <Disc className="w-20 h-20 text-white/10 mb-4" />
                            <div className="hidden md:block absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black to-transparent">
                                <h3 className="font-bold text-gray-400 truncate text-center">{localVinyl.title || 'Unknown'}</h3>
                                <p className="text-gray-600 truncate text-center text-sm">{localVinyl.artist}</p>
                            </div>
                        </div>
                    )}

                    {/* Overlay Controls (Top Right) */}
                    {!selectionMode && (
                        <div className="flex absolute top-2 right-2 gap-2 z-50 transform-gpu">
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(vinyl); }}
                                className="p-2 md:p-3 bg-black/60 hover:bg-black/90 active:scale-95 active:bg-black text-white rounded-full backdrop-blur-md shadow-lg border border-white/10 transition-all"
                                title="Edit"
                            >
                                <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                            <button
                                onClick={handleAnalyze}
                                className={`p-2 md:p-3 rounded-full backdrop-blur-md shadow-lg border border-white/10 transition-all active:scale-95 ${isPending ? 'bg-yellow-500 text-black animate-pulse' : 'bg-black/60 hover:bg-black/90 active:bg-black text-white'}`}
                                title="Magic Analyze"
                                disabled={analyzing}
                            >
                                {analyzing ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Wand2 className="w-4 h-4 md:w-5 md:h-5" />}
                            </button>
                            <a
                                href={`https://open.spotify.com/search/${encodeURIComponent((localVinyl.artist === 'Pending AI' ? '' : localVinyl.artist || '') + ' ' + (localVinyl.title || ''))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex p-2 md:p-3 bg-[#1DB954] hover:bg-[#1ed760] active:scale-95 text-black rounded-full backdrop-blur-md shadow-lg border border-white/10 transition-all"
                                title="Play on Spotify"
                            >
                                <PlayCircle className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                            </a >
                            <a
                                href={`https://www.youtube.com/results?search_query=${encodeURIComponent((localVinyl.artist === 'Pending AI' ? '' : localVinyl.artist || '') + ' ' + (localVinyl.title || ''))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex p-2 md:p-3 bg-[#FF0000] hover:bg-[#cc0000] active:scale-95 text-white rounded-full backdrop-blur-md shadow-lg border border-white/10 transition-all"
                                title="Search on YouTube"
                            >
                                <Youtube className="w-4 h-4 md:w-5 md:h-5" />
                            </a>
                        </div >
                    )}



                </div >

                {/* BACK FACE (DETAILS) */}
                < div className="absolute inset-0 backface-hidden rotate-y-180 bg-black border border-white/10 rounded-xl overflow-hidden shadow-xl flex flex-col relative z-0" >

                    {/* 1. Background Image - More visible now */}
                    {
                        localVinyl.image_url && (
                            <div
                                className="absolute inset-0 z-0 bg-cover bg-center opacity-40 blur-md scale-110 saturate-50"
                                style={{ backgroundImage: `url(${localVinyl.image_url})` }}
                            />
                        )
                    }

                    {/* 2. Gradient Overlay for text readability */}
                    <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />

                    {/* 3. Content Container - Safe from Flip */}
                    <div
                        className="flex-1 flex flex-col p-5 relative z-10 h-full overflow-hidden cursor-auto"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Header: Title + Mini Thumbnail */}
                        <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-2">
                            <div className="flex-1 pr-2">
                                <h4 className="font-bold text-white text-sm truncate">{localVinyl.artist}</h4>
                                <p className="text-xs text-gray-400 truncate">{localVinyl.title}</p>
                            </div>
                            {/* Explicit Mini Thumbnail requested by user */}
                            {localVinyl.image_url && (
                                <img
                                    src={localVinyl.image_url}
                                    className="w-10 h-10 rounded-md border border-white/20 object-cover shadow-sm"
                                    alt="thumb"
                                />
                            )}
                        </div>

                        {/* Scrollable Details */}
                        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">

                            {/* Group Members */}
                            <div>
                                <h5 className="text-[10px] uppercase tracking-widest text-accent/80 font-bold mb-1 flex items-center gap-1">
                                    Members
                                </h5>
                                <p className="text-xs text-gray-200 leading-relaxed font-light">
                                    {localVinyl.group_members || "—"}
                                </p>
                            </div>

                            {/* Tracks */}
                            <div>
                                <h5 className="text-[10px] uppercase tracking-widest text-accent/80 font-bold mb-1 flex items-center gap-1">
                                    Tracks
                                </h5>
                                <div className="text-xs text-gray-300 font-light max-h-24 overflow-y-auto space-y-1 pr-1 scrollbar-none">
                                    {localVinyl.tracks ? localVinyl.tracks.split('\n').map((track, i) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-white/30 w-4 text-right flex-shrink-0">{i + 1}.</span>
                                            <span className="truncate">{track}</span>
                                        </div>
                                    )) : <span className="text-white/20 italic">No tracks listed</span>}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <h5 className="text-[10px] uppercase tracking-widest text-accent/80 font-bold mb-1 flex items-center gap-1">
                                    Notes
                                </h5>
                                <p className="text-xs text-gray-300 italic leading-relaxed border-l-2 border-white/10 pl-2">
                                    {localVinyl.notes || "—"}
                                </p>
                            </div>

                            {/* Meta Grid */}
                            <div className="grid grid-cols-2 gap-y-3 gap-x-2 bg-white/5 p-3 rounded-lg border border-white/5 mt-2">
                                <div>
                                    <span className="block text-[10px] text-gray-500 uppercase">Condition</span>
                                    <span className="text-xs font-medium text-white">{localVinyl.condition || 'Good'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-500 uppercase">Format</span>
                                    <span className="text-xs font-bold text-accent">{localVinyl.format || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-500 uppercase">Year</span>
                                    <span className="text-xs font-medium text-white">{localVinyl.year || 'Unknown'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-500 uppercase">Genre</span>
                                    <span className="text-xs font-medium text-white truncate">{localVinyl.genre || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-500 uppercase">Est. Value</span>
                                    <span className="text-xs font-medium text-green-400">{localVinyl.avarege_cost || localVinyl.average_cost || '-'}</span>
                                </div>
                                <div className="col-span-1">
                                    <span className="block text-[10px] text-gray-500 uppercase">Rating</span>
                                    <div className="flex gap-0.5">
                                        {localVinyl.rating > 0 ? (
                                            [...Array(localVinyl.rating)].map((_, i) => (
                                                <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-yellow-400">
                                                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                                </svg>
                                            ))
                                        ) : (
                                            <span className="text-xs text-white/20">-</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="pt-3 mt-auto border-t border-white/10 flex justify-between items-center">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFlip(); // Use prop
                                }}
                                className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                            >
                                ← Back to Cover
                            </button>

                            {!selectionMode && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(vinyl.id);
                                    }}
                                    className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                                    title="Delete Vinyl"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div >
            </div >
        </div >
    );
}, (prev, next) => {
    // Custom comparison to ignore function prop changes (which can be unstable)
    // Only re-render if data or visual state actually changes
    const isSameVinyl = prev.vinyl === next.vinyl;
    const isSameSelection = prev.isSelected === next.isSelected;

    // Additional check for visual mode props
    return (
        isSameVinyl &&
        isSameSelection &&
        prev.isFlipped === next.isFlipped &&
        prev.selectionMode === next.selectionMode
    );
});
