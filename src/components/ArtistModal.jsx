import React, { useState, useEffect } from 'react';
import { X, ExternalLink, PlayCircle, Loader2, Sparkles, Disc, Music, Calendar } from 'lucide-react';
import { fetchArtistWikipediaInfo } from '../lib/wikipedia';
import { generateArtistFunFact } from '../lib/openai';
import { pb } from '../lib/pocketbase';

export function ArtistModal({ artistName, isOpen, onClose }) {
    const [wikiData, setWikiData] = useState(null);
    const [funFact, setFunFact] = useState(null);
    const [collection, setCollection] = useState([]);
    const [loadingWiki, setLoadingWiki] = useState(true);
    const [loadingFact, setLoadingFact] = useState(true);
    const [loadingCollection, setLoadingCollection] = useState(true);

    useEffect(() => {
        if (!isOpen || !artistName) return;

        // Reset states
        setWikiData(null);
        setFunFact(null);
        setCollection([]);
        setLoadingWiki(true);
        setLoadingFact(true);
        setLoadingCollection(true);

        const loadArtistData = async () => {
            let dbArtistRef = null;
            try {
                // Try to find in DB first
                const records = await pb.collection('artists').getList(1, 1, {
                    filter: pb.filter('name = {:artist}', { artist: artistName })
                });

                if (records.items && records.items.length > 0) {
                    const dbArtist = records.items[0];
                    dbArtistRef = dbArtist;
                    
                    // If the artist has a valid bio, use it and stop here
                    const currentBio = dbArtist.bio || '';
                    const isMissingBio = currentBio.length < 25 || 
                                       currentBio.toLowerCase().includes('non trovata su wikipedia') ||
                                       currentBio.toLowerCase().includes('biografia non disponibile');

                    if (!isMissingBio) {
                        setWikiData({ extract: dbArtist.bio, imageUrl: dbArtist.image_url, url: `https://it.wikipedia.org/wiki/${encodeURIComponent(artistName)}` });
                        setFunFact(dbArtist.fun_fact);
                        setLoadingWiki(false);
                        setLoadingFact(false);
                        return;
                    }
                    // Otherwise, we'll keep the fun_fact but we will fetch the wiki info again
                    setFunFact(dbArtist.fun_fact);
                    // we'll need the ID later to update instead of create
                }
            } catch (err) {
                console.warn("DB Artist fetch error:", err);
            }

            // Not found in DB, fallback to generation
            let newWikiData = null;
            try {
                newWikiData = await fetchArtistWikipediaInfo(artistName);
                setWikiData(newWikiData);
            } catch (e) {
                console.error("Wiki error:", e);
            }
            setLoadingWiki(false);

            let newFunFact = "Nessuna curiosità disponibile al momento.";
            // Only generate fact if we don't have one from DB
            if (dbArtistRef && dbArtistRef.fun_fact) {
                newFunFact = dbArtistRef.fun_fact;
                setFunFact(newFunFact);
                setLoadingFact(false);
            } else {
                try {
                    newFunFact = await generateArtistFunFact(artistName);
                    setFunFact(newFunFact);
                } catch (err) {
                    console.error("Fun fact error:", err);
                }
                setLoadingFact(false);
            }

            // Save back to DB if we generated it
            try {
                const savePayload = {
                    name: artistName,
                    bio: newWikiData?.extract?.substring(0, 5000) || '',
                    fun_fact: newFunFact,
                    image_url: newWikiData?.imageUrl || ''
                };
                if (dbArtistRef && dbArtistRef.id) {
                    await pb.collection('artists').update(dbArtistRef.id, savePayload);
                } else {
                    await pb.collection('artists').create(savePayload);
                }
            } catch (saveErr) {
                console.warn("Could not save artist to DB:", saveErr);
            }
        };

        loadArtistData();

        // Fetch Collection
        const fetchCollection = async () => {
            try {
                // Exact or partial match, case insensitive
                const records = await pb.collection('vinyls').getFullList({
                    filter: pb.filter('artist ~ {:artist}', { artist: artistName }),
                    sort: '-year'
                });
                
                // Map images
                const mapped = records.map(doc => ({
                    ...doc,
                    image_url: doc.image ? pb.files.getUrl(doc, doc.image, { thumb: '100x100' }) : null
                }));
                setCollection(mapped);
            } catch (err) {
                console.error("Collection fetch error:", err);
            } finally {
                setLoadingCollection(false);
            }
        };
        fetchCollection();

        // Lock scroll
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen, artistName]);

    if (!isOpen || !artistName) return null;

    return (
        <div className="fixed inset-0 z-[110] flex flex-col bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50 sticky top-0 z-10 shrink-0">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 text-white/70 hover:text-white rounded-full active:bg-white/10 transition-colors"
                >
                    <X className="w-8 h-8" />
                </button>
                <div className="flex-1 text-center font-bold text-xl truncate px-4">
                    {artistName}
                </div>
                <div className="w-8" /> {/* Spacer */}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-12">
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    
                    {/* Wiki Section */}
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Image */}
                        <div className="w-full md:w-1/3 shrink-0 rounded-2xl overflow-hidden bg-white/5 border border-white/10 aspect-square flex items-center justify-center">
                            {loadingWiki ? (
                                <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                            ) : wikiData?.imageUrl ? (
                                <img src={wikiData.imageUrl} alt={artistName} className="w-full h-full object-cover" />
                            ) : (
                                <Music className="w-16 h-16 text-white/20" />
                            )}
                        </div>

                        {/* Bio */}
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black text-white not-italic" style={{ color: 'white' }}>{artistName}</h2>
                                {!loadingWiki && !wikiData?.extract && (
                                    <button 
                                        onClick={() => {
                                            setLoadingWiki(true);
                                            // Re-trigger the search by clearing cache check
                                            // Since we are inside the component, we can just call loadArtistData again
                                            // but we need to make sure loadArtistData is accessible or we just trigger a state change
                                            window.location.reload(); // Simplest way to force a full re-run for now
                                        }}
                                        className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-white/50 hover:text-white transition-all"
                                    >
                                        Riprova ricerca
                                    </button>
                                )}
                            </div>
                            {loadingWiki ? (
                                <div className="space-y-3 animate-pulse">
                                    <div className="h-4 bg-white/10 rounded w-full"></div>
                                    <div className="h-4 bg-white/10 rounded w-5/6"></div>
                                    <div className="h-4 bg-white/10 rounded w-4/6"></div>
                                    <div className="h-4 bg-white/10 rounded w-full"></div>
                                </div>
                            ) : (
                                <p className="text-gray-300 leading-relaxed text-lg">
                                    {wikiData?.extract ? wikiData.extract : (
                                        <span className="text-white/40 italic">
                                            Biografia non trovata su Wikipedia per questo artista.
                                        </span>
                                    )}
                                </p>
                            )}
                            
                            {wikiData?.url && (
                                <a href={wikiData.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                                    Leggi di più su Wikipedia <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* AI Fun Fact */}
                    <div className="relative p-6 sm:p-8 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-900/40 via-black to-[#1a1a1a] border border-indigo-500/30 shadow-2xl">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles className="w-24 h-24" />
                        </div>
                        <h3 className="text-xs uppercase tracking-[0.2em] text-indigo-400 font-bold mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Lo Sapevi Che...
                        </h3>
                        {loadingFact ? (
                            <div className="flex items-center gap-3 text-indigo-300/50">
                                <Loader2 className="w-5 h-5 animate-spin" /> Generazione curiosità in corso...
                            </div>
                        ) : (
                            <p className="text-indigo-100/90 font-serif text-lg md:text-xl leading-relaxed relative z-10 italic">
                                "{funFact}"
                            </p>
                        )}
                    </div>

                    {/* External Links (Smart Links) */}
                    <div className="space-y-4">
                        <h3 className="text-sm uppercase tracking-widest text-secondary font-bold border-b border-white/10 pb-2">
                            Live & Extra
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <a href={`https://www.ticketmaster.com/search?q=${encodeURIComponent(artistName)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 p-4 rounded-xl bg-[#026cdf]/10 hover:bg-[#026cdf]/20 border border-[#026cdf]/30 text-[#026cdf] hover:text-blue-300 transition-colors">
                                <Calendar className="w-5 h-5" /> Cerca Concerti (TM)
                            </a>
                            <a href={`https://www.songkick.com/search?utf8=✓&type=initial&query=${encodeURIComponent(artistName)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 p-4 rounded-xl bg-[#f80046]/10 hover:bg-[#f80046]/20 border border-[#f80046]/30 text-[#f80046] hover:text-pink-400 transition-colors">
                                <Calendar className="w-5 h-5" /> Date Tour (Songkick)
                            </a>
                            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(artistName + ' live')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 p-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 hover:text-red-400 transition-colors">
                                <PlayCircle className="w-5 h-5" /> Guarda Live (YouTube)
                            </a>
                        </div>
                    </div>

                    {/* In Your Collection */}
                    <div className="space-y-4">
                        <h3 className="text-sm uppercase tracking-widest text-secondary font-bold border-b border-white/10 pb-2 flex items-center justify-between">
                            <span>Nella tua Collezione</span>
                            {!loadingCollection && (
                                <span className="bg-white/10 px-2 py-0.5 rounded text-xs text-white">{collection.length}</span>
                            )}
                        </h3>
                        
                        {loadingCollection ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                            </div>
                        ) : collection.length === 0 ? (
                            <p className="text-white/40 py-4 italic">Nessun altro disco trovato.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {collection.map(vinyl => (
                                    <div key={vinyl.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-colors flex flex-col">
                                        <div className="aspect-square bg-black relative">
                                            {vinyl.image_url ? (
                                                <img src={vinyl.image_url} alt={vinyl.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><Disc className="w-8 h-8 text-white/20" /></div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="font-bold text-sm truncate">{vinyl.title}</p>
                                            <p className="text-xs text-secondary truncate">{vinyl.year || 'Anno ignoto'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
