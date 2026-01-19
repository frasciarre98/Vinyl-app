import React, { useEffect, useState } from 'react';
import { X, Edit2, Trash2, Calendar, Disc, Music2, AlertCircle, CheckCircle, ListMusic, DollarSign, PlayCircle, Youtube, Wand2, Loader2 } from 'lucide-react';
import { analyzeImageUrl, getApiKey } from '../lib/openai';
import { databases, DATABASE_ID } from '../lib/appwrite';

const icons = { PlayCircle, Youtube }; // Quick fix for previous replacement using icons.Namespace

export function VinylDetailModal({ vinyl: initialVinyl, isOpen, onClose, onEdit, onDelete }) {
    // Local state to handle updates immediately
    const [vinyl, setVinyl] = useState(initialVinyl);
    const [analyzing, setAnalyzing] = useState(false);

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

    if (!isOpen || !vinyl) return null;

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

            // Appwrite Update
            const fullUpdate = {
                artist: analysis.artist,
                title: analysis.title,
                genre: analysis.genre,
                year: String(analysis.year || '').substring(0, 50),
                notes: String(analysis.notes || '').substring(0, 4000),
                group_members: String(analysis.group_members || '').substring(0, 999),
                condition: analysis.condition,
                avarege_cost: String(analysis.average_cost || '').substring(0, 50),
                tracks: String(analysis.tracks || '').substring(0, 4999)
            };

            // Respect User Validation
            if (vinyl.is_tracks_validated) {
                delete fullUpdate.tracks;
            }

            await databases.updateDocument(
                DATABASE_ID,
                'vinyls',
                vinyl.id,
                fullUpdate
            );

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
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className={`p-2 rounded-full transition-all ${analyzing ? 'bg-yellow-500/20 text-yellow-400' : 'text-purple-400 hover:text-purple-300 bg-purple-500/10'}`}
                    >
                        {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={() => onEdit(vinyl)}
                        className="p-2 text-blue-400 hover:text-blue-300 bg-blue-500/10 rounded-full"
                    >
                        <Edit2 className="w-6 h-6" />
                    </button>
                    {/* External Links */}
                    <a
                        href={`https://open.spotify.com/search/${encodeURIComponent((vinyl.artist || '') + ' ' + (vinyl.title || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#1DB954] hover:text-[#1ed760] bg-[#1DB954]/10 rounded-full"
                    >
                        <icons.PlayCircle className="w-6 h-6" />
                    </a>
                    <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent((vinyl.artist || '') + ' ' + (vinyl.title || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 rounded-full"
                    >
                        <icons.Youtube className="w-6 h-6" />
                    </a>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (typeof onDelete !== 'function') {
                                alert("Error: Delete function is missing. Please reload.");
                                console.error("onDelete prop is missing in VinylDetailModal");
                                return;
                            }
                            onDelete(vinyl.id);
                        }}
                        className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 rounded-full"
                    >
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col min-h-full pb-20">

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
                            <p className="text-xl text-primary font-medium">
                                {vinyl.artist || 'Unknown Artist'}
                            </p>
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
                            {(vinyl.avarege_cost || vinyl.average_cost) && (
                                <div className="bg-green-900/20 px-4 py-2 rounded-full border border-green-500/20 flex items-center gap-2 text-green-400">
                                    <DollarSign className="w-4 h-4" />
                                    {vinyl.avarege_cost || vinyl.average_cost}
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
                                <h4 className="text-xs uppercase text-secondary mb-2">Notes</h4>
                                <p className="text-gray-400 font-light italic leading-relaxed border-l-2 border-white/10 pl-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20">
                                    {vinyl.notes || '—'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 pt-2 text-xs text-white/30">
                                <AlertCircle className="w-3 h-3" />
                                <span className="uppercase">Condition:</span>
                                <span className="text-white">{vinyl.condition || 'N/A'}</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
