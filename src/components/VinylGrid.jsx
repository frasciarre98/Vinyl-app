import React, { useState, useEffect } from 'react';
import { Search, Loader2, Trash2, CheckSquare, Square } from 'lucide-react';
import { databases, DATABASE_ID } from '../lib/appwrite';
import { Query } from 'appwrite';
import { VinylCard } from './VinylCard';
import { BatchAnalysisBanner } from './BatchAnalysisBanner';
import { analyzeImageUrl, getApiKey } from '../lib/openai';

export function VinylGrid({ refreshTrigger, onEdit }) {
    const [vinyls, setVinyls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedArtist, setSelectedArtist] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('');

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    // Single Active Card State
    const [flippedCardId, setFlippedCardId] = useState(null);


    useEffect(() => {
        fetchVinyls();
    }, [refreshTrigger]);

    // Compute Filter Options
    const uniqueArtists = [...new Set(vinyls.map(v => v.artist).filter(Boolean).sort())];
    const uniqueGenres = [...new Set(vinyls.map(v => v.genre).filter(Boolean).map(g => g.split(',')[0].trim()).sort())];

    const fetchVinyls = async () => {
        try {
            setLoading(true);
            let allVinyls = [];
            // Loop to fetch ALL records using Offset (Simpler & More Reliable for <5k items)
            let offset = 0;
            let currentChunkSize = 0;

            do {
                const response = await databases.listDocuments(
                    DATABASE_ID,
                    'vinyls',
                    [
                        Query.orderDesc('$createdAt'),
                        Query.limit(100),
                        Query.offset(offset)
                    ]
                );

                const chunk = response.documents.map(doc => ({
                    ...doc,
                    id: doc.$id
                }));

                console.log(`Fetch pass at offset ${offset}: Got ${chunk.length} items.`);

                allVinyls = [...allVinyls, ...chunk];
                currentChunkSize = chunk.length;
                offset += 100;

                // Safety break for Appwrite offset limit
                if (offset >= 5000) break;

            } while (currentChunkSize === 100);

            setVinyls(allVinyls);
            setSelectedIds([]);
            setIsSelectionMode(false);
        } catch (err) {
            console.error('Error fetching vinyls:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateVinyl = (id, updates) => {
        setVinyls(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    };

    const handleToggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} albums ? This cannot be undone.`)) return;

        setLoading(true);
        try {
            // Process 1 by 1 to be absolutely safe against Rate Limits
            const batchSize = 1;
            for (let i = 0; i < selectedIds.length; i += batchSize) {
                const chunk = selectedIds.slice(i, i + batchSize);
                await Promise.all(chunk.map(id =>
                    databases.deleteDocument(DATABASE_ID, 'vinyls', id)
                ));
                // 1000ms delay between EACH deletion
                if (i + batchSize < selectedIds.length) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // Optimistic update or refresh
            fetchVinyls();
        } catch (err) {
            console.error('Error deleting vinyls:', err);
            alert('Failed to delete vinyls: ' + err.message + '\n\nCheck Appwrite Permissions for "Delete".');
            setLoading(false);
        }
    };

    const handleBatchPriceEstimate = async () => {
        const apiKey = getApiKey();
        if (!apiKey) {
            alert("No API Key found. Please set it in Settings first.");
            return;
        }

        if (!confirm(`Calculate Average Price for ${selectedIds.length} records? This will use AI and might take a moment.`)) return;

        setLoading(true);
        let successCount = 0;

        try {
            // Get the actual vinyl objects for selected IDs
            const selectedVinyls = vinyls.filter(v => selectedIds.includes(v.id));

            for (let i = 0; i < selectedVinyls.length; i++) {
                const vinyl = selectedVinyls[i];
                // Visual feedback in loading state could be improved, but for now we just wait
                console.log(`Estimating price for: ${vinyl.title}`);

                try {
                    // Use existing metadata as hint to ensure accuracy
                    const hint = `${vinyl.artist} - ${vinyl.title}`;
                    const analysis = await analyzeImageUrl(vinyl.image_url, apiKey, hint);

                    if (analysis.average_cost) {
                        await databases.updateDocument(
                            DATABASE_ID,
                            'vinyls',
                            vinyl.id, // Using mapped 'id' which is '$id'
                            { average_cost: analysis.average_cost }
                        );

                        successCount++;
                        // Optimistic update
                        setVinyls(prev => prev.map(v => v.id === vinyl.id ? { ...v, average_cost: analysis.average_cost } : v));
                    }

                    // Small delay to respect rate limits
                    await new Promise(r => setTimeout(r, 1000));

                } catch (e) {
                    console.error(`Failed to estimate for ${vinyl.title}:`, e);
                }
            }

            alert(`Estimation complete! Updated ${successCount} records.`);

        } catch (err) {
            console.error('Batch estimation failed:', err);
            alert('Batch process failed.');
        } finally {
            setLoading(false);
            setIsSelectionMode(false);
            setSelectedIds([]);
        }
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds([]);
    };

    const filteredVinyls = vinyls.filter(v => {
        const matchesSearch = (
            v.title?.toLowerCase().includes(search.toLowerCase()) ||
            v.artist?.toLowerCase().includes(search.toLowerCase()) ||
            v.genre?.toLowerCase().includes(search.toLowerCase()) ||
            v.tracks?.toLowerCase().includes(search.toLowerCase()) // Search within tracklists
        );
        const matchesArtist = selectedArtist ? v.artist === selectedArtist : true;
        const matchesGenre = selectedGenre ? v.genre?.includes(selectedGenre) : true;

        return matchesSearch && matchesArtist && matchesGenre;
    });

    // ...

    // --- EMERGENCY RESCUE MODE ---
    // Set to TRUE to unblock the user. Set back to FALSE after cleanup.
    const EMERGENCY_MODE = false;

    if (EMERGENCY_MODE) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-2xl max-w-md">
                    <h1 className="text-3xl text-red-500 font-bold mb-4">⚠️ Modalità Integrità</h1>
                    <p className="text-gray-300 mb-6">
                        Il sistema è sovraccarico (troppi dischi caricati insieme).
                        Per sbloccare il browser, dobbiamo resettare il database.
                    </p>
                    <button
                        onClick={async () => {
                            if (!confirm("SEI SICURO? Cancellando tutto perderai i dischi caricati. Usalo solo se sei bloccato.")) return;
                            try {
                                const list = await databases.listDocuments(DATABASE_ID, 'vinyls', [Query.limit(100)]);
                                await Promise.all(list.documents.map(doc => databases.deleteDocument(DATABASE_ID, 'vinyls', doc.$id)));
                                alert("Database pulito con successo! Ricarica la pagina per ricominciare.");
                                window.location.reload();
                            } catch (e) {
                                alert("Errore cancellazione: " + e.message);
                            }
                        }}
                        className="w-full px-6 py-4 bg-red-600 text-white font-bold text-lg rounded-xl hover:bg-red-700 shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Trash2 className="w-6 h-6" />
                        CANCELLA TUTTO E RIPARTI
                    </button>
                </div>
            </div>
        );
    }
    // -----------------------------

    return (
        <div className="space-y-8">
            <BatchAnalysisBanner
                vinyls={vinyls}
                onUpdate={handleUpdateVinyl}
                onComplete={fetchVinyls}
            />

            {/* Controls Bar */}
            <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-white/5 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-lg transition-all duration-300">
                {/* Search Bar & Filters */}
                <div className="relative flex-1 w-full gap-4 flex flex-col md:flex-row">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-secondary" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-border rounded-full leading-5 bg-surface text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-base sm:text-sm transition-all shadow-sm hover:shadow-md"
                        />
                    </div>

                    {/* Artist Filter */}
                    <select
                        value={selectedArtist}
                        onChange={(e) => setSelectedArtist(e.target.value)}
                        className="bg-surface border border-border text-primary text-base sm:text-sm rounded-full focus:ring-accent/50 focus:border-accent/50 block p-3 max-w-[200px]"
                    >
                        <option value="">All Artists</option>
                        {uniqueArtists.map((artist, idx) => (
                            <option key={idx} value={artist}>{artist}</option>
                        ))}
                    </select>

                    {/* Genre Filter */}
                    <select
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="bg-surface border border-border text-primary text-base sm:text-sm rounded-full focus:ring-accent/50 focus:border-accent/50 block p-3 max-w-[200px]"
                    >
                        <option value="">All Genres</option>
                        {uniqueGenres.map((genre, idx) => (
                            <option key={idx} value={genre}>{genre}</option>
                        ))}
                    </select>
                </div>

                {/* Total Count Badge */}
                <div className="hidden md:flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-full text-secondary text-sm font-mono whitespace-nowrap shadow-sm" title="Total collection size">
                    <span className="font-bold text-primary mr-1">{vinyls.length}</span> records
                </div>

                {/* Selection Actions */}
                <div className="flex items-center gap-2">
                    {/* REPROCESS ERRORS BUTTON */}
                    {vinyls.some(v => v.artist === 'Error') && (
                        <button
                            onClick={async () => {
                                const errorIds = vinyls.filter(v => v.artist === 'Error').map(v => v.id);
                                if (!confirm(`Reset ${errorIds.length} failed items to 'Pending' state?`)) return;

                                setLoading(true);
                                try {
                                    // Appwrite requires individual updates
                                    await Promise.all(errorIds.map(id =>
                                        databases.updateDocument(DATABASE_ID, 'vinyls', id, { artist: 'Pending AI', notes: null })
                                    ));
                                    await fetchVinyls();
                                } catch (e) {
                                    alert("Error resetting items: " + e.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full hover:bg-yellow-500/20 border border-yellow-500/50 transition-colors font-medium text-sm animate-pulse"
                        >
                            <Loader2 className="w-4 h-4" />
                            Fix {vinyls.filter(v => v.artist === 'Error').length} Errors
                        </button>
                    )}

                    {/* Bulk Analyze Button - HANDLED BY BANNER NOW */}
                    {isSelectionMode ? (
                        <>
                            <button
                                onClick={() => {
                                    if (selectedIds.length === filteredVinyls.length) {
                                        setSelectedIds([]);
                                    } else {
                                        setSelectedIds(filteredVinyls.map(v => v.id));
                                    }
                                }}
                                className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors border border-border rounded-full"
                            >
                                {selectedIds.length === filteredVinyls.length ? 'Deselect All' : 'Select All'}
                            </button>
                            <button
                                onClick={handleBatchPriceEstimate}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors font-medium text-sm"
                            >
                                <CheckSquare className="w-4 h-4" />
                                Average Price ({selectedIds.length})
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedIds.length === 0}
                                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete ({selectedIds.length})
                            </button>
                            <button
                                onClick={toggleSelectionMode}
                                className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={toggleSelectionMode}
                            className="flex items-center gap-2 bg-surface text-secondary px-4 py-2 rounded-full hover:bg-white/5 hover:text-primary transition-colors font-medium text-sm border border-border"
                        >
                            <CheckSquare className="w-4 h-4" />
                            Select
                        </button>
                    )}
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
            ) : filteredVinyls.length === 0 ? (
                <div className="text-center py-20 text-secondary">
                    <p className="text-xl font-light">No records found.</p>
                    <p className="text-sm mt-2">Try adjusting your search or add some vinyls.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {filteredVinyls.map(vinyl => (
                            <VinylCard
                                key={vinyl.id}
                                vinyl={vinyl}
                                onEdit={onEdit}
                                onDelete={async (id) => {
                                    if (confirm('Delete this record?')) {
                                        try {
                                            await databases.deleteDocument(DATABASE_ID, 'vinyls', id);
                                            setVinyls(prev => prev.filter(v => v.id !== id));
                                        } catch (e) {
                                            console.error("Delete failed:", e);
                                            alert("Delete failed: " + e.message + "\n\nCheck your Appwrite permissions.");
                                        }
                                    }
                                }}
                                selectionMode={isSelectionMode}
                                isSelected={selectedIds.includes(vinyl.id)}
                                onToggleSelect={handleToggleSelect}
                                // New Props for Single Active Logic
                                isFlipped={flippedCardId === vinyl.id}
                                onFlip={() => setFlippedCardId(flippedCardId === vinyl.id ? null : vinyl.id)}
                            />
                        ))}
                    </div>


                </div>
            )}
        </div>
    );
}
