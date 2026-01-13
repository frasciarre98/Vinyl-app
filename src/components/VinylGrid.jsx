import React, { useState, useEffect } from 'react';
import { Search, Loader2, Trash2, CheckSquare, Sparkles, Filter, X } from 'lucide-react';
import { databases, DATABASE_ID } from '../lib/appwrite';
import { Query } from 'appwrite';
import { VinylCard } from './VinylCard';
import { BatchAnalysisBanner } from './BatchAnalysisBanner';
import { VinylDetailModal } from './VinylDetailModal';
import { analyzeImageUrl, getApiKey } from '../lib/openai';

export function VinylGrid({ refreshTrigger, onEdit }) {
    const [vinyls, setVinyls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedArtist, setSelectedArtist] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('');
    // Sort Order: 'newest' (default) | 'artist_asc'
    const [sortOrder, setSortOrder] = useState('newest');

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    // UI States
    const [flippedCardId, setFlippedCardId] = useState(null);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [selectedDetailVinyl, setSelectedDetailVinyl] = useState(null);

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
            let offset = 0;
            let currentChunkSize = 0;

            do {
                const response = await databases.listDocuments(
                    DATABASE_ID,
                    'vinyls',
                    [Query.orderDesc('$createdAt'), Query.limit(100), Query.offset(offset)]
                );
                const chunk = response.documents.map(doc => ({ ...doc, id: doc.$id }));
                allVinyls = [...allVinyls, ...chunk];
                currentChunkSize = chunk.length;
                offset += 100;
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

    const handleUpdateVinyl = (id, updates) => setVinyls(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));

    const handleToggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} albums?`)) return;
        setLoading(true);
        try {
            for (let i = 0; i < selectedIds.length; i++) {
                await databases.deleteDocument(DATABASE_ID, 'vinyls', selectedIds[i]);
                await new Promise(r => setTimeout(r, 200)); // Rate limit safety
            }
            fetchVinyls();
        } catch (err) {
            alert('Bulk delete failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBatchPriceEstimate = async () => {
        const apiKey = getApiKey();
        if (!apiKey) return alert("API Key missing.");
        if (!confirm(`Estimate price for ${selectedIds.length} records?`)) return;

        setLoading(true);
        let count = 0;
        try {
            const selectedVinyls = vinyls.filter(v => selectedIds.includes(v.id));
            for (const vinyl of selectedVinyls) {
                try {
                    const analysis = await analyzeImageUrl(vinyl.image_url, apiKey, `${vinyl.artist} - ${vinyl.title}`);
                    if (analysis.average_cost) {
                        await databases.updateDocument(DATABASE_ID, 'vinyls', vinyl.id, { average_cost: analysis.average_cost });
                        setVinyls(prev => prev.map(v => v.id === vinyl.id ? { ...v, average_cost: analysis.average_cost } : v));
                        count++;
                    }
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) { console.error(e); }
            }
            alert(`Updated ${count} records.`);
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
        const matchesSearch = (v.title?.toLowerCase().includes(search.toLowerCase()) || v.artist?.toLowerCase().includes(search.toLowerCase()) || v.genre?.toLowerCase().includes(search.toLowerCase()));
        const matchesArtist = selectedArtist ? v.artist === selectedArtist : true;
        const matchesGenre = selectedGenre ? v.genre?.includes(selectedGenre) : true;
        return matchesSearch && matchesArtist && matchesGenre;
    }).sort((a, b) => {
        if (sortOrder === 'artist_asc') {
            return (a.artist || '').localeCompare(b.artist || '');
        }
        return 0; // Default is 'newest' which corresponds to the API order (desc createdAt) preserved by filter
    });

    return (
        <div className="space-y-6">
            <BatchAnalysisBanner vinyls={vinyls} onUpdate={handleUpdateVinyl} onComplete={fetchVinyls} />

            {/* Mobile Filter Toggle & Count */}
            <div className="flex md:hidden items-center justify-between sticky top-16 z-30 bg-background/95 backdrop-blur shadow-sm p-4 -mx-4 mb-4 border-b border-white/10">
                <div className="font-mono text-xs text-secondary">
                    <span className="text-primary font-bold">{vinyls.length}</span> RECORDS
                </div>
                <div className="flex gap-2">
                    {/* Mobile Sort Toggle */}
                    <button
                        onClick={() => setSortOrder(prev => prev === 'newest' ? 'artist_asc' : 'newest')}
                        className={`p-2 rounded-full border transition-colors ${sortOrder === 'artist_asc' ? 'bg-accent text-black border-accent' : 'bg-white/5 border-white/10 text-white'}`}
                        title={sortOrder === 'newest' ? "Sort by Artist (A-Z)" : "Sort by Newest"}
                    >
                        {sortOrder === 'artist_asc' ? "A-Z" : "New"}
                    </button>
                    <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={`p-2 rounded-full border transition-colors ${isFiltersOpen ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-white'}`}
                    >
                        {isFiltersOpen ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                    </button>
                    {/* Compact Selection Toggle */}
                    <button
                        onClick={toggleSelectionMode}
                        className={`p-2 rounded-full border transition-colors ${isSelectionMode ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white'}`}
                    >
                        <CheckSquare className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Desktop / Collapsible Filters Bar */}
            <div className={`
                sticky md:top-20 top-[120px] z-20 bg-background/95 backdrop-blur-xl 
                md:py-4 md:-mx-4 md:px-4 md:border-b md:border-white/5 md:flex md:flex-row md:gap-4 md:justify-between md:items-center md:shadow-lg
                ${isFiltersOpen ? 'block p-4 border-b border-white/5 animate-in slide-in-from-top-10' : 'hidden md:flex'}
            `}>
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
                            className="block w-full pl-10 pr-3 py-3 border border-border rounded-full leading-5 bg-surface text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-base sm:text-sm"
                        />
                    </div>
                    <select value={selectedArtist} onChange={(e) => setSelectedArtist(e.target.value)} className="bg-surface border border-border text-primary rounded-full p-3 md:max-w-[200px]">
                        <option value="">All Artists</option>
                        {uniqueArtists.map((artist, i) => <option key={i} value={artist}>{artist}</option>)}
                    </select>
                    <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="bg-surface border border-border text-primary rounded-full p-3 md:max-w-[200px]">
                        <option value="">All Genres</option>
                        {uniqueGenres.map((genre, i) => <option key={i} value={genre}>{genre}</option>)}
                    </select>
                </div>

                {/* Desktop Buttons */}
                <div className="hidden md:flex items-center gap-2">
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-secondary text-sm font-mono whitespace-nowrap shadow-sm">
                        <span className="font-bold text-primary mr-1">{vinyls.length}</span> records
                    </div>

                    {/* Desktop Sort Toggle */}
                    <button
                        onClick={() => setSortOrder(prev => prev === 'newest' ? 'artist_asc' : 'newest')}
                        className={`px-4 py-2 rounded-full border transition-colors text-sm font-medium ${sortOrder === 'artist_asc' ? 'bg-accent text-black border-accent' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                    >
                        {sortOrder === 'artist_asc' ? "Sort: A-Z" : "Sort: Newest"}
                    </button>

                    <button onClick={fetchVinyls} disabled={loading} className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white">
                        <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {isSelectionMode ? (
                        <>
                            <button
                                onClick={() => setSelectedIds(selectedIds.length === filteredVinyls.length ? [] : filteredVinyls.map(v => v.id))}
                                className="px-4 py-2 text-sm text-secondary hover:text-primary border border-border rounded-full"
                            >
                                {selectedIds.length === filteredVinyls.length ? 'Deselect All' : 'Select All'}
                            </button>
                            <button onClick={handleBatchPriceEstimate} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full text-sm">
                                <CheckSquare className="w-4 h-4" /> Avg Price ({selectedIds.length})
                            </button>
                            <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full text-sm">
                                <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                            </button>
                            <button onClick={toggleSelectionMode} className="px-4 py-2 text-sm text-secondary hover:text-primary">Cancel</button>
                        </>
                    ) : (
                        <button onClick={toggleSelectionMode} className="flex items-center gap-2 bg-surface text-secondary px-4 py-2 rounded-full hover:bg-white/5 border border-border text-sm">
                            <CheckSquare className="w-4 h-4" /> Select
                        </button>
                    )}
                </div>

                {/* Mobile Selection Action Bar (Only visible when selecting on mobile) */}
                {isSelectionMode && (
                    <div className="md:hidden mt-4 pt-4 border-t border-white/10 flex gap-2 overflow-x-auto pb-2">
                        <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full text-sm whitespace-nowrap">
                            <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                        </button>
                        <button onClick={handleBatchPriceEstimate} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full text-sm whitespace-nowrap">
                            <CheckSquare className="w-4 h-4" /> Price
                        </button>
                    </div>
                )}
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
            ) : filteredVinyls.length === 0 ? (
                <div className="text-center py-20 text-secondary"><p className="text-xl font-light">No records found.</p></div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-6 pb-20">
                    {filteredVinyls.map(vinyl => (
                        <VinylCard
                            key={vinyl.id}
                            vinyl={vinyl}
                            onEdit={onEdit}
                            onDelete={(id) => {
                                if (confirm('Delete this record?')) databases.deleteDocument(DATABASE_ID, 'vinyls', id).then(() => setVinyls(p => p.filter(v => v.id !== id)));
                            }}
                            selectionMode={isSelectionMode}
                            isSelected={selectedIds.includes(vinyl.id)}
                            onToggleSelect={handleToggleSelect}
                            isFlipped={flippedCardId === vinyl.id}
                            onFlip={() => setFlippedCardId(flippedCardId === vinyl.id ? null : vinyl.id)}
                            onViewDetail={() => setSelectedDetailVinyl(vinyl)}
                        />
                    ))}
                </div>
            )}

            <VinylDetailModal
                vinyl={selectedDetailVinyl}
                isOpen={!!selectedDetailVinyl}
                onClose={() => setSelectedDetailVinyl(null)}
                onEdit={(v) => { setSelectedDetailVinyl(null); onEdit(v); }}
                onDelete={async (id) => {
                    if (confirm('Delete this record?')) {
                        await databases.deleteDocument(DATABASE_ID, 'vinyls', id);
                        setVinyls(p => p.filter(v => v.id !== id));
                        setSelectedDetailVinyl(null);
                    }
                }}
            />
        </div>
    );
}
