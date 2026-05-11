import React, { useEffect, useState } from 'react';
import { X, Edit2, Trash2, Calendar, Disc, Music2, AlertCircle, CheckCircle, ListMusic, Euro, PlayCircle, Youtube, Wand2, Loader2, Music } from 'lucide-react';
import { analyzeImageUrl, getApiKey } from '../lib/openai';
import { pb } from '../lib/pocketbase';
import { ArtistModal } from './ArtistModal';

const icons = { PlayCircle, Youtube }; // Quick fix for previous replacement using icons.Namespace

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true';

export function VinylDetailModal({ vinyl: initialVinyl, isOpen, onClose, onEdit, onDelete }) {
    // Local state to handle updates immediately
    const [user, setUser] = useState(pb.authStore.model);
    useEffect(() => {
        return pb.authStore.onChange((token, model) => {
            setUser(model);
        });
    }, []);
    const [vinyl, setVinyl] = useState(initialVinyl);
    const [analyzing, setAnalyzing] = useState(false);
    const [generatingStory, setGeneratingStory] = useState(false);
    const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);

    useEffect(() => {
        setVinyl(initialVinyl);
    }, [initialVinyl]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const missingFields = React.useMemo(() => {
        if (!vinyl) return [];
        const fields = [];
        if (!vinyl.label || vinyl.label === 'Unknown') fields.push('Label');
        if (!vinyl.edition || vinyl.edition === 'Unknown') fields.push('Edition');
        if (!vinyl.average_cost && !vinyl.avarege_cost) fields.push('Estimated Value');
        return fields;
    }, [vinyl]);

    if (!isOpen || !vinyl) return null;

    const handleGenerateStory = async () => {
        if (!vinyl.artist || !vinyl.title) {
            alert("Artist and Title are required to generate a story.");
            return;
        }
        setGeneratingStory(true);
        try {
            const res = await fetch('/api/ai/story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    artist: vinyl.artist, 
                    title: vinyl.title,
                    apiKey: getApiKey()
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate story');

            const fullUpdate = { liner_notes: data.story };
            await pb.collection('vinyls').update(vinyl.id, fullUpdate);

            setVinyl(prev => ({ ...prev, liner_notes: data.story }));
        } catch (err) {
            console.error(err);
            alert(`Story generation failed: ${err.message}`);
        } finally {
            setGeneratingStory(false);
        }
    };

    const handleAnalyze = async () => {
        // Guided AI: Ask for hint
        let hint = null;
        if (vinyl.title || vinyl.artist) {
            const userInput = prompt("Guided Analysis: Help the AI by entering the Artist and Album Name.\n\nLeave empty to run standard analysis.");
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

            const analysis = await analyzeImageUrl(vinyl.image_url, apiKey, hint);

            // Database Update
            const fullUpdate = {
                artist: analysis.artist,
                title: analysis.title,
                genre: analysis.genre,
                year: String(analysis.year || '').substring(0, 50),
                notes: String(analysis.notes || '').substring(0, 4000),
                group_members: String(analysis.group_members || '').substring(0, 999),
                condition: analysis.condition,
                average_cost: String(analysis.average_cost || '').substring(0, 50),
                avarege_cost: String(analysis.average_cost || '').substring(0, 50),
                tracks: String(analysis.tracks || '').substring(0, 4999),
                label: analysis.label || vinyl.label || '', // Preserve existing if not returned
                catalog_number: analysis.catalog_number || vinyl.catalog_number || '',
                edition: analysis.edition || vinyl.edition || '',
                liner_notes: String(analysis.liner_notes || '').substring(0, 5000)
            };

            // Respect User Validation & Property Locks
            const lockedFields = Array.isArray(vinyl.locked_fields) ? vinyl.locked_fields : [];
            
            // Log for debugging
            if (lockedFields.length > 0) {
                console.log(">> Record has locked fields:", lockedFields);
            }

            // Remove locked fields from the update payload
            for (const field of lockedFields) {
                if (fullUpdate.hasOwnProperty(field)) {
                    delete fullUpdate[field];
                }
            }

            // Unify price lock logic for both schema typos
            if ((lockedFields.includes('average_cost') || lockedFields.includes('avarege_cost'))) {
                if (fullUpdate.avarege_cost !== undefined) delete fullUpdate.avarege_cost;
                if (fullUpdate.average_cost !== undefined) delete fullUpdate.average_cost;
            }

            if (vinyl.is_tracks_validated) {
                delete fullUpdate.tracks;
            }

            await pb.collection('vinyls').update(vinyl.id, fullUpdate);

            // Update local view
            setVinyl(prev => ({ ...prev, ...analysis }));
            alert("Analysis Complete!");

        } catch (err) {
            console.error("Analysis failed:", err);
            alert(`Analysis Failed: ${err.message}`);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/30 backdrop-blur-3xl animate-in slide-in-from-bottom duration-300">
            {/* Header / Actions */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50 sticky top-0 z-10 shrink-0">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 text-white/70 hover:text-white rounded-full active:bg-white/10 transition-colors"
                >
                    <X className="w-8 h-8" />
                </button>
                <div className="flex gap-2">
                    {!IS_STATIC && user && (
                        <>
                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className={`p-2 rounded-full transition-all ${analyzing ? 'bg-yellow-500/20 text-yellow-400' : 'text-purple-400 hover:text-purple-300 bg-purple-500/10'}`}
                                title="Full AI Analysis"
                            >
                                {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                            </button>
                            <button
                                onClick={handleGenerateStory}
                                disabled={generatingStory}
                                className={`p-2 rounded-full transition-all ${generatingStory ? 'bg-purple-900/50 text-purple-400' : 'text-pink-400 hover:text-pink-300 bg-pink-500/10'}`}
                                title="Generate Story / Liner Notes"
                            >
                                {generatingStory ? <Loader2 className="w-6 h-6 animate-spin" /> : <span className="text-xl leading-none">📖</span>}
                            </button>
                            <button
                                onClick={() => onEdit(vinyl)}
                                className="p-2 text-blue-400 hover:text-blue-300 bg-blue-500/10 rounded-full"
                                title="Edit Record"
                            >
                                <Edit2 className="w-6 h-6" />
                            </button>
                        </>
                    )}

                    {/* External Links - Transparent Mode */}
                    <a
                        href={`https://open.spotify.com/search/${encodeURIComponent((vinyl.artist || '') + ' ' + (vinyl.title || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#1DB954] hover:text-[#1ed760] hover:bg-white/10 rounded-full transition-colors"
                        title="Listen on Spotify"
                    >
                        <icons.PlayCircle className="w-6 h-6" />
                    </a>
                    <a
                        href={`https://music.apple.com/search?term=${encodeURIComponent((vinyl.artist || '') + ' ' + (vinyl.title || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#FA243C] hover:text-[#fc475c] hover:bg-white/10 rounded-full transition-colors"
                        title="Listen on Apple Music"
                    >
                        <Music className="w-6 h-6" />
                    </a>
                    <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent((vinyl.artist || '') + ' ' + (vinyl.title || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-red-500 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors"
                        title="Listen on YouTube"
                    >
                        <icons.Youtube className="w-6 h-6" />
                    </a>
                    {!IS_STATIC && user && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (typeof onDelete !== 'function') {
                                    alert("Error: Delete function is missing. Please reload.");
                                    return;
                                }
                                onDelete(vinyl.id);
                            }}
                            className="p-2 text-white/40 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <Trash2 className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col min-h-full pb-20">

                    {/* Missing Info Warning */}
                    {missingFields.length > 0 && !IS_STATIC && (
                        <div className="bg-yellow-500/20 border-b border-yellow-500/30 p-3 flex items-center justify-between animate-in fade-in slide-in-from-top duration-300">
                            <div className="flex items-center gap-2 text-yellow-500 text-sm font-medium">
                                <AlertCircle className="w-4 h-4" />
                                <span>Missing: {missingFields.join(', ')}</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-yellow-500/50">Needs AI or Manual Fix</span>
                        </div>
                    )}

                    {/* Large Cover Art with Gradient */}
                    <div className="relative w-full aspect-square max-h-[50vh] bg-black shrink-0">
                        {vinyl.image_url ? (
                            <img
                                src={vinyl.image_url}
                                alt={vinyl.title}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10">
                                <Disc className="w-32 h-32" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    </div>

                    {/* Metadata Container */}
                    <div className="px-6 -mt-12 relative z-10 space-y-8">

                        {/* Title & Artist */}
                        <div className="space-y-2">
                            <h1 className="text-3xl font-black text-white leading-tight dropshadow-xl">
                                {vinyl.title || 'Unknown Album'}
                            </h1>
                            <button 
                                onClick={() => setIsArtistModalOpen(true)}
                                className="group flex items-center gap-3 text-lg text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/20 transition-all active:scale-95 w-fit mt-3 shadow-lg"
                            >
                                <Music2 className="w-4 h-4 text-purple-400" />
                                <span className="font-bold">{vinyl.artist || 'Unknown Artist'}</span>
                                <span className="text-[10px] uppercase tracking-widest text-white/50 ml-1 border-l border-white/20 pl-3">Esplora Artista &rarr;</span>
                            </button>
                        </div>



                        {/* Quick Stats Row */}
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-gray-300">
                                <Calendar className="w-4 h-4 text-secondary" />
                                <span className="text-white">{vinyl.year || 'N/A'}</span>
                            </div>
                            <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-gray-300">
                                <Music2 className="w-4 h-4 text-secondary" />
                                <span className="text-white">{vinyl.genre || 'N/A'}</span>
                            </div>
                            <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-gray-300">
                                <Disc className="w-4 h-4 text-secondary" />
                                <span className="text-white">{vinyl.format || 'Vinyl'}</span>
                            </div>
                            {(vinyl.average_cost || vinyl.avarege_cost) && (
                                <div className="bg-green-900/20 px-4 py-2 rounded-full border border-green-500/20 flex items-center gap-2 text-green-400">
                                    <Euro className="w-4 h-4" />
                                    {vinyl.average_cost || vinyl.avarege_cost}
                                </div>
                            )}
                            {/* Rating Display */}
                            {vinyl.rating > 0 && (
                                <div className="bg-yellow-900/20 px-4 py-2 rounded-full border border-yellow-500/20 flex items-center gap-1 text-yellow-400">
                                    <span className="font-bold mr-1">{vinyl.rating}</span>
                                    {[...Array(vinyl.rating)].map((_, i) => (
                                        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                        </svg>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Editorial Story / Liner Notes */}
                        {vinyl.liner_notes && vinyl.liner_notes.length > 50 && vinyl.liner_notes !== 'Analyzed by AI' && (
                            <div className="relative group p-6 sm:p-8 mt-8 mb-8 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/20 via-black to-[#1a1a1a] border border-purple-500/20 shadow-2xl">
                                {/* Decorative elements */}
                                <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500/10 rounded-br-full blur-3xl pointer-events-none" />
                                <h3 className="text-[10px] uppercase tracking-[0.3em] text-purple-400/80 font-bold mb-6 flex items-center gap-4">
                                    <span className="w-12 h-[1px] bg-purple-500/50" />
                                    Storia & Aneddoti
                                </h3>
                                <div className="text-gray-200 font-serif leading-relaxed text-base sm:text-lg opacity-90 relative z-10 space-y-4">
                                    {vinyl.liner_notes.split('\n\n').map((paragraph, idx) => (
                                        <p key={idx} className={idx === 0 ? "first-letter:text-6xl first-letter:font-black first-letter:text-purple-400 first-letter:mr-3 first-letter:float-left first-line:uppercase first-line:tracking-widest" : ""}>
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tracks */}
                        <div className="space-y-4">
                            <h3 className="text-sm uppercase tracking-widest text-secondary font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                                <ListMusic className="w-4 h-4" /> Tracklist
                            </h3>
                            <div className="space-y-3 pl-2">
                                {vinyl.tracks ? (
                                    vinyl.tracks.split('\n').map((track, i) => (
                                        <div key={i} className="flex gap-4 text-gray-300 text-base py-1 border-b border-white/5 last:border-0">
                                            <span className="text-white/20 font-mono w-6 text-right shrink-0">{i + 1}</span>
                                            <span className="font-light">{track}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-white/30 italic px-4">No tracks listed</p>
                                )}
                            </div>
                        </div>

                        {/* Additional Data Grid */}
                        <div className="grid grid-cols-1 gap-6 pt-4">
                            <div>
                                <h4 className="text-xs uppercase text-secondary mb-2">Group Members</h4>
                                <p className="text-gray-400 font-light leading-relaxed">
                                    {vinyl.group_members || '—'}
                                </p>
                            </div>
                            <div>
                                <h4 className="text-xs uppercase text-secondary mb-2">Notes & Appraisal</h4>
                                <p className="text-gray-400 font-light italic leading-relaxed border-l-2 border-white/10 pl-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20">
                                    {vinyl.notes || '—'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 pt-2 text-xs text-white/30">
                                <AlertCircle className="w-3 h-3" />
                                <span className="uppercase">Condition:</span>
                                <span className="text-white">{vinyl.condition || 'N/A'}</span>
                            </div>

                            {/* --- COLLECTOR DETAILS --- */}
                            {(vinyl.label || vinyl.catalog_number || vinyl.edition) && (
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                    <h4 className="text-xs uppercase text-secondary font-bold flex items-center gap-2">
                                        <Disc className="w-4 h-4" /> Collector Info
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        {vinyl.label && (
                                            <div>
                                                <span className="block text-xs text-white/40">Label</span>
                                                <span className="text-white font-medium">{vinyl.label}</span>
                                            </div>
                                        )}
                                        {vinyl.catalog_number && (
                                            <div>
                                                <span className="block text-xs text-white/40">Catalog No.</span>
                                                <span className="font-mono text-accent/80">{vinyl.catalog_number}</span>
                                            </div>
                                        )}
                                        {vinyl.edition && (
                                            <div className="col-span-2">
                                                <span className="block text-xs text-white/40">Edition / Variant</span>
                                                <span className="text-white/80">{vinyl.edition}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* --- ACQUISITION --- */}
                            {(vinyl.purchase_price || vinyl.purchase_year) && (
                                <div className="p-4 bg-emerald-900/10 rounded-xl border border-emerald-500/20 space-y-3">
                                    <h4 className="text-xs uppercase text-emerald-400 font-bold flex items-center gap-2">
                                        <Euro className="w-4 h-4" /> Acquisition
                                    </h4>
                                    <div className="flex gap-8 text-sm">
                                        {vinyl.purchase_price && (
                                            <div>
                                                <span className="block text-xs text-emerald-400/50">Paid</span>
                                                <span className="text-emerald-100 font-medium">€ {vinyl.purchase_price}</span>
                                            </div>
                                        )}
                                        {vinyl.purchase_year && (
                                            <div>
                                                <span className="block text-xs text-emerald-400/50">Year</span>
                                                <span className="text-emerald-100 font-medium">{vinyl.purchase_year}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Render ArtistModal conditionally */}
            <ArtistModal 
                isOpen={isArtistModalOpen} 
                onClose={() => setIsArtistModalOpen(false)} 
                artistName={vinyl.artist} 
            />
        </div>
    );
}
