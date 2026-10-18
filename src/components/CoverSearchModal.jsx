import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Check, Globe, Disc, Music, Sparkles } from 'lucide-react';
import { searchAppleMusic, fetchAlbumTracks, downloadCoverAsFile } from '../lib/musicSearch';

export function CoverSearchModal({ isOpen, onClose, initialArtist = '', initialTitle = '', onSelectCover }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [applyingId, setApplyingId] = useState(null);
    const [updateMetadata, setUpdateMetadata] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const defaultQ = `${initialArtist || ''} ${initialTitle || ''}`.trim();
            setQuery(defaultQ);
            if (defaultQ) {
                performSearch(defaultQ);
            } else {
                setResults([]);
            }
        }
    }, [isOpen, initialArtist, initialTitle]);

    const performSearch = async (searchQuery) => {
        if (!searchQuery || !searchQuery.trim()) return;
        setLoading(true);
        try {
            const items = await searchAppleMusic(searchQuery, 30);
            setResults(items);
        } catch (err) {
            console.error("Search failed:", err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        performSearch(query);
    };

    const handleApply = async (release) => {
        setApplyingId(release.id);
        try {
            // 1. Download cover
            const coverFile = await downloadCoverAsFile(release.thumb, 'cover.jpg');

            // 2. Optionally fetch tracks and metadata
            let metadata = null;
            if (updateMetadata) {
                let tracklist = '';
                if (release.collectionId) {
                    tracklist = await fetchAlbumTracks(release.collectionId);
                }

                metadata = {
                    title: release.title,
                    artist: release.artist,
                    year: release.year,
                    genre: release.genre,
                    label: release.label,
                    tracks: tracklist
                };
            }

            await onSelectCover(coverFile, metadata);
            onClose();
        } catch (err) {
            console.error("Failed to apply cover:", err);
            alert("Errore nell'applicazione della copertina: " + err.message);
        } finally {
            setApplyingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                Cerca Copertina Online
                                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Apple Music HD
                                </span>
                            </h3>
                            <p className="text-xs text-white/50">
                                Trova copertine originali ad altissima risoluzione per sostituire foto storte o sfocate.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar & Options */}
                <div className="p-4 border-b border-white/10 bg-black/20 space-y-3">
                    <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Cerca artista, album o titolo..."
                                className="w-full bg-slate-800 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-colors shrink-0 shadow-md"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            <span>Cerca</span>
                        </button>
                    </form>

                    {/* Quick filter chips & metadata toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white/40">Suggeriti:</span>
                            {initialArtist && (
                                <button
                                    type="button"
                                    onClick={() => { setQuery(initialArtist); performSearch(initialArtist); }}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors"
                                >
                                    Solo "{initialArtist}"
                                </button>
                            )}
                            {initialTitle && (
                                <button
                                    type="button"
                                    onClick={() => { setQuery(initialTitle); performSearch(initialTitle); }}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors"
                                >
                                    Solo "{initialTitle}"
                                </button>
                            )}
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none text-white/80 hover:text-white bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                            <input
                                type="checkbox"
                                checked={updateMetadata}
                                onChange={(e) => setUpdateMetadata(e.target.checked)}
                                className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                            />
                            <span className="flex items-center gap-1 font-medium">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                Aggiorna anche dati (Anno, Genere, Tracce)
                            </span>
                        </label>
                    </div>
                </div>

                {/* Results List / Grid */}
                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                            <p className="text-sm text-white/70">Ricerca copertine in corso su Apple Music...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {results.map((release) => (
                                <div
                                    key={release.id}
                                    className="flex items-center gap-4 bg-slate-800/80 hover:bg-slate-800 border border-white/10 hover:border-emerald-500/50 p-3 rounded-xl transition-all shadow-md group"
                                >
                                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/50 shrink-0 border border-white/10 relative shadow">
                                        {release.thumb ? (
                                            <img
                                                src={release.thumb}
                                                alt={release.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                                <Disc className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-white text-sm truncate leading-snug" title={release.title}>
                                            {release.title}
                                        </h4>
                                        <p className="text-emerald-400 text-xs font-medium truncate mb-1">
                                            {release.artist}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 text-[11px] text-white/50 mb-2">
                                            {release.year && <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{release.year}</span>}
                                            {release.genre && <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 truncate max-w-[120px]">{release.genre}</span>}
                                            {release.trackCount > 0 && <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{release.trackCount} tr.</span>}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleApply(release)}
                                            disabled={applyingId !== null}
                                            className="w-full bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                        >
                                            {applyingId === release.id ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Applicazione...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Usa questa copertina</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-white/40 space-y-2">
                            <Disc className="w-12 h-12 text-white/20 mb-2" />
                            <p className="text-base font-medium text-white/60">
                                {query ? "Nessun risultato trovato su Apple Music." : "Digita un artista o titolo per cercare."}
                            </p>
                            <p className="text-xs max-w-sm">
                                Prova a semplificare la ricerca, ad esempio cercando solo il nome dell'artista o il titolo principale dell'album.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
