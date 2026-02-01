import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Trash2, CheckSquare, Sparkles, Filter, X, ArrowUpDown, ChevronDown, RotateCcw } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { VinylCard } from './VinylCard';
import { BatchAnalysisBanner } from './BatchAnalysisBanner';
import { CollectionValueKPI } from './CollectionValueKPI';
import { VinylDetailModal } from './VinylDetailModal';
import { EditVinylModal } from './EditVinylModal';
import { UndoToast } from './UndoToast';
import { analyzeImageUrl, getApiKey } from '../lib/openai';
import { SearchableSelect } from './SearchableSelect';
import staticData from '../data/vinyls-static.json';

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true' || import.meta.env.PROD;

export function VinylGrid({ refreshTrigger }) {
    const [vinyls, setVinyls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [trackSearch, setTrackSearch] = useState('');
    const [selectedArtist, setSelectedArtist] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('');
    const [selectedRating, setSelectedRating] = useState('0');
    // Sort Order: 'newest' (default) | 'artist_asc'
    const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('vinyl_sort_order') || 'newest');

    useEffect(() => {
        localStorage.setItem('vinyl_sort_order', sortOrder);
    }, [sortOrder]);

    // Pagination State (Local Performance Optimization)
    const [visibleCount, setVisibleCount] = useState(24);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    // UI States
    const [flippedCardId, setFlippedCardId] = useState(null);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false); // Controls Bottom Sheet on Mobile
    const [selectedDetailVinyl, setSelectedDetailVinyl] = useState(null);
    const [editingVinyl, setEditingVinyl] = useState(null); // Local state for Edit Modal
    const [isSearchExpanded, setIsSearchExpanded] = useState(false); // For mobile compacted search

    useEffect(() => {
        fetchVinyls();
    }, [refreshTrigger]);

    // Compute Filter Options
    const uniqueArtists = [...new Set(vinyls.map(v => v.artist).filter(Boolean).sort())];
    const uniqueGenres = [...new Set(vinyls.map(v => v.genre).filter(Boolean).map(g => g.split(',')[0].trim()).sort())];

    // Compute Format Counts
    const vinylCount = vinyls.filter(v => !v.format || v.format === 'Vinyl').length;
    const cdCount = vinyls.filter(v => v.format === 'CD').length;

    const fetchVinyls = async () => {
        try {
            setLoading(true);

            if (IS_STATIC) {
                console.log("📁 Running in STATIC MODE (Reading from JSON)", staticData?.length, "records");
                // Static data already has image_url mapped to /storage/...
                const allVinyls = (staticData || []).map(doc => ({
                    ...doc,
                    $createdAt: doc.created || doc.$createdAt || new Date().toISOString()
                }));
                console.log("✅ Static records mapped:", allVinyls.length);
                setVinyls(allVinyls);
                setLoading(false); // <--- Explicitly set here just in case
                return;
            }

            const records = await pb.collection('vinyls').getFullList({
                requestKey: null
            });

            const allVinyls = records.map(doc => ({
                ...doc,
                $createdAt: doc.created,
                image_url: doc.image ? pb.files.getUrl(doc, doc.image) : null
            }));

            setVinyls(allVinyls);
            setSelectedIds([]);
            setIsSelectionMode(false);
            setError(null);
        } catch (err) {
            console.error('Error fetching vinyls:', err);
            setError(`Connection Failed: ${err.message}. Ensure you are on the same WiFi as the Mac.`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateVinyl = (id, updates) => setVinyls(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));

    const handleToggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // UNDO Logic State
    const [deletedItems, setDeletedItems] = useState([]); // { items: [], timeoutId: null }
    const undoTimeoutRef = useRef(null);

    const executePermanentDelete = async (itemsToDelete) => {
        try {
            for (const item of itemsToDelete) {
                await pb.collection('vinyls').delete(item.id);
            }
            console.log('Permanently deleted', itemsToDelete.length, 'items');
        } catch (err) {
            console.error('Delete failed', err);
            fetchVinyls();
        }
    };

    const handleSoftDelete = (itemsToDelete) => {
        if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
            if (deletedItems.length > 0) {
                executePermanentDelete(deletedItems);
            }
        }

        const ids = itemsToDelete.map(i => i.id);
        setVinyls(prev => prev.filter(v => !ids.includes(v.id)));
        setDeletedItems(itemsToDelete);
        setSelectedIds([]);
        setIsSelectionMode(false);

        undoTimeoutRef.current = setTimeout(() => {
            executePermanentDelete(itemsToDelete);
            setDeletedItems([]);
            undoTimeoutRef.current = null;
        }, 600000);
    };

    const handleUndo = () => {
        if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = null;
        }
        setVinyls(prev => [...deletedItems, ...prev].sort((a, b) => b.$createdAt.localeCompare(a.$createdAt)));
        setDeletedItems([]);
    };

    const handleBulkDelete = () => {
        const toDelete = vinyls.filter(v => selectedIds.includes(v.id));
        handleSoftDelete(toDelete);
    };

    const handleSingleDelete = (id) => {
        const item = vinyls.find(v => v.id === id);
        if (item) handleSoftDelete([item]);
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
                        await pb.collection('vinyls').update(vinyl.id, { average_cost: analysis.average_cost });
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

    const handleBatchFormatChange = async (newFormat) => {
        if (!confirm(`Set format to ${newFormat} for ${selectedIds.length} records?`)) return;

        setLoading(true);
        try {
            const updates = selectedIds.map(id =>
                pb.collection('vinyls').update(id, { format: newFormat })
            );

            await Promise.all(updates);

            setVinyls(prev => prev.map(v => selectedIds.includes(v.id) ? { ...v, format: newFormat } : v));

            alert(`Updated ${selectedIds.length} records to ${newFormat}.`);
        } catch (err) {
            console.error(err);
            alert('Batch update failed: ' + err.message);
        } finally {
            setLoading(false);
            setIsSelectionMode(false);
            setSelectedIds([]);
        }
    };

    const handleBatchFullAnalysis = async () => {
        const apiKey = getApiKey();
        if (!apiKey) return alert("API Key missing.");
        if (!confirm(`Deep Analyze metadata for ${selectedIds.length} records?\nThis will update Notes, Tracks, and other info using the new AI Settings.`)) return;

        setLoading(true);
        let count = 0;
        try {
            const selectedVinyls = vinyls.filter(v => selectedIds.includes(v.id));
            for (const vinyl of selectedVinyls) {
                try {
                    const hint = vinyl.artist && vinyl.artist !== 'Pending AI' ? `${vinyl.artist} - ${vinyl.title}` : null;
                    const analysis = await analyzeImageUrl(vinyl.image_url, apiKey, hint);

                    const fullUpdate = {
                        artist: analysis.artist,
                        title: analysis.title,
                        genre: analysis.genre,
                        year: analysis.year,
                        notes: String(analysis.notes || '').substring(0, 4000),
                        group_members: analysis.group_members,
                        condition: analysis.condition,
                        avarege_cost: String(analysis.average_cost || '').substring(0, 50),
                        tracks: analysis.tracks
                    };

                    if (vinyl.is_tracks_validated) {
                        delete fullUpdate.tracks;
                    }

                    await pb.collection('vinyls').update(vinyl.id, fullUpdate);
                    setVinyls(prev => prev.map(v => v.id === vinyl.id ? { ...v, ...fullUpdate } : v));
                    count++;

                    await new Promise(r => setTimeout(r, 2000));

                } catch (e) { console.error(`Failed to analyze ${vinyl.id}:`, e); }
            }
            alert(`Deep Analysis completed for ${count} records.`);
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

    const resetFilters = () => {
        setSearch('');
        setTrackSearch('');
        setSelectedArtist('');
        setSelectedGenre('');
        setSelectedRating('0');
        setIsFiltersOpen(false);
    };

    // Filter Logic (Memoized)
    const filteredVinyls = useMemo(() => {
        let result = vinyls.filter(vinyl => {
            const matchesSearch = search === '' ||
                (vinyl.title?.toLowerCase() || '').includes(search.toLowerCase()) ||
                (vinyl.artist?.toLowerCase() || '').includes(search.toLowerCase()) ||
                (vinyl.tracks?.toLowerCase() || '').includes(search.toLowerCase());

            const matchesArtist = !selectedArtist || vinyl.artist === selectedArtist;
            const matchesGenre = !selectedGenre || (vinyl.genre && vinyl.genre.includes(selectedGenre));

            let matchesRating = true;
            if (selectedRating === 'needs_attention') {
                // Filter for Errors OR Missing key metadata
                matchesRating = (vinyl.artist === 'Error' ||
                    vinyl.artist === 'Pending AI' ||
                    !vinyl.artist ||
                    vinyl.artist === 'Unknown Artist' ||
                    !vinyl.title ||
                    vinyl.title === 'Unknown Title');
            } else if (selectedRating === 'unrated') {
                matchesRating = !vinyl.rating || vinyl.rating === 0;
            } else if (selectedRating !== '0') {
                matchesRating = (vinyl.rating || 0) >= parseInt(selectedRating);
            }

            const matchesTrack = !trackSearch || (vinyl.tracks?.toLowerCase() || '').includes(trackSearch.toLowerCase());

            return matchesSearch && matchesArtist && matchesGenre && matchesRating && matchesTrack;
        });

        // Sort
        result.sort((a, b) => {
            if (sortOrder === 'artist_asc') {
                return (a.artist || '').localeCompare(b.artist || '');
            }
            return new Date(b.$createdAt) - new Date(a.$createdAt);
        });

        return result;
    }, [vinyls, search, selectedArtist, selectedGenre, selectedRating, sortOrder, trackSearch]);

    const visibleVinyls = filteredVinyls.slice(0, visibleCount);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 24);
    };

    const activeFiltersCount = [selectedArtist, selectedGenre, selectedRating !== '0'].filter(Boolean).length;
    return (
        <div className="space-y-6 relative pb-4 md:pb-0">
            {/* --- UNDO TOAST --- */}
            {deletedItems.length > 0 && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-900 border border-white/20 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 fade-in duration-300 backdrop-blur-md">
                    <span className="font-medium">
                        Deleted <span className="text-red-400 font-bold">{deletedItems.length}</span> record{deletedItems.length > 1 ? 's' : ''}.
                    </span>
                    <button onClick={handleUndo} className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-200 active:scale-95 transition-all flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" /> UNDO
                    </button>
                    <button onClick={() => executePermanentDelete(deletedItems)} className="ml-2 text-white/20 hover:text-white transition-colors">✕</button>
                </div>
            )}

            {!IS_STATIC && (
                <BatchAnalysisBanner vinyls={vinyls} onUpdate={handleUpdateVinyl} onComplete={fetchVinyls} />
            )}

            {/* --- COLLECTION VALUE KPI --- */}
            <CollectionValueKPI vinyls={vinyls} />

            {/* --- MOBILE STICKY HEADER --- */}
            <div className={`
                md:hidden sticky top-16 z-40 -mx-4 px-4 py-3 
                bg-background/80 backdrop-blur-md border-b border-white/5 
                flex items-center justify-between transition-all duration-300
            `}>
                <div className="flex-1 flex items-center">
                    {isSearchExpanded ? (
                        <div className="flex items-center w-full animate-in fade-in slide-in-from-left-5">
                            <input autoFocus type="text" placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => !search && setIsSearchExpanded(false)} className="w-full bg-transparent text-lg placeholder-white/30 outline-none text-white" />
                            <button onClick={() => { setSearch(''); setIsSearchExpanded(false); }} className="p-2 text-white/50"><X className="w-5 h-5" /></button>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold tracking-tight text-white">Collection</span>
                                <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{vinyls.length}</span>
                            </div>
                            <span className="text-[10px] text-white/40 font-mono tracking-wider">{vinylCount} VINYL • {cdCount} CD</span>
                        </div>
                    )}
                </div>

                {!isSearchExpanded && (
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsSearchExpanded(true)} className="p-2 rounded-full text-white/70 hover:bg-white/10 active:scale-95 transition-all"><Search className="w-5 h-5" /></button>
                        <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'artist_asc' : 'newest')} className={`p-2 rounded-full transition-all active:scale-95 ${sortOrder === 'artist_asc' ? 'text-accent' : 'text-white/70 hover:bg-white/10'}`}><ArrowUpDown className="w-5 h-5" /></button>
                        <button onClick={() => setIsFiltersOpen(true)} className={`p-2 rounded-full transition-all active:scale-95 relative ${activeFiltersCount > 0 ? 'text-primary' : 'text-white/70 hover:bg-white/10'}`}><Filter className="w-5 h-5" />{activeFiltersCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full ring-2 ring-black" />}</button>
                        {!IS_STATIC && (
                            <button onClick={toggleSelectionMode} className={`p-2 rounded-full transition-all active:scale-95 ${isSelectionMode ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'}`}><CheckSquare className="w-5 h-5" /></button>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile Artist Quick Search */}
            <div className="md:hidden px-4 -mt-2 mb-4">
                <SearchableSelect
                    options={uniqueArtists}
                    value={selectedArtist}
                    onChange={setSelectedArtist}
                    placeholder="Filter by Artist..."
                    className="w-full"
                    icon={Search}
                />
            </div>

            {/* --- MOBILE BOTTOM SHEET FILTERS --- */}
            {isFiltersOpen && <div className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsFiltersOpen(false)} />}
            <div className={`fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-white/10 rounded-t-3xl p-6 md:hidden transition-transform duration-300 ease-out shadow-2xl ${isFiltersOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Filters</h3>{activeFiltersCount > 0 && <button onClick={resetFilters} className="text-sm text-red-400 font-medium">Reset All</button>}</div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-8">
                    <div className="space-y-2"><label className="text-xs uppercase tracking-wider text-white/40 font-bold ml-1">Track Name</label><div className="relative"><input type="text" name="mobile_track_search" autoComplete="off" value={trackSearch} onChange={(e) => setTrackSearch(e.target.value)} placeholder="Search for a song..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-white/30" /></div></div>
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-white/40 font-bold ml-1">Artist</label>
                        <SearchableSelect
                            options={uniqueArtists}
                            value={selectedArtist}
                            onChange={setSelectedArtist}
                            placeholder="Search artist..."
                            className="w-full"
                        />
                    </div>
                    <div className="space-y-2"><label className="text-xs uppercase tracking-wider text-white/40 font-bold ml-1">Genre</label><div className="relative"><select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"><option value="">All Genres</option>{uniqueGenres.map((genre, i) => <option key={i} value={genre}>{genre}</option>)}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" /></div></div>
                    <div className="space-y-2"><label className="text-xs uppercase tracking-wider text-white/40 font-bold ml-1">Rating</label><div className="relative"><select value={selectedRating} onChange={(e) => setSelectedRating(e.target.value)} className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"><option value="0">Any Rating</option><option value="needs_attention">⚠ Needs Attention</option><option value="5">Excellent (5 Stars)</option><option value="4">Great (4+ Stars)</option><option value="3">Good (3+ Stars)</option><option value="unrated">Unrated</option></select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" /></div></div>
                </div>
                <div className="pt-4 border-t border-white/10 mt-4"><button onClick={() => setIsFiltersOpen(false)} className="w-full bg-primary text-black font-bold py-4 rounded-xl active:scale-[0.98] transition-transform">Show {filteredVinyls.length} Records</button></div>
            </div>

            {/* --- DESKTOP FILTERS --- */}
            <div className="hidden md:flex sticky top-20 z-20 bg-background/95 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-white/5 flex-row gap-4 justify-between items-center shadow-lg">
                <div className="relative flex-1 w-full gap-4 flex flex-row">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-secondary" /></div>
                        <input type="text" name="main_search" autoComplete="off" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-border rounded-full leading-5 bg-surface text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm" />
                    </div>
                    <input type="text" name="track_search_query" autoComplete="off" placeholder="Track Name..." value={trackSearch} onChange={(e) => setTrackSearch(e.target.value)} className="bg-surface border border-border text-primary rounded-full px-4 py-3 max-w-[200px] text-sm placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50" />
                    <SearchableSelect
                        options={uniqueArtists}
                        value={selectedArtist}
                        onChange={setSelectedArtist}
                        placeholder="All Artists"
                        className="w-[200px]"
                    />
                    <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="bg-surface border border-border text-primary rounded-full p-3 max-w-[200px]"><option value="">All Genres</option>{uniqueGenres.map((genre, i) => <option key={i} value={genre}>{genre}</option>)}</select>
                    <select value={selectedRating} onChange={(e) => setSelectedRating(e.target.value)} className="bg-surface border border-border text-primary rounded-full p-3 max-w-[200px] font-medium">
                        <option value="0">All Ratings</option>
                        <option value="needs_attention">⚠ Needs Attention</option>
                        <option value="5">5 Stars Only</option>
                        <option value="4">4+ Stars</option>
                        <option value="3">3+ Stars</option>
                        <option value="2">2+ Stars</option>
                        <option value="1">1+ Star</option>
                        <option value="unrated">Unrated</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-secondary text-sm font-mono whitespace-nowrap shadow-sm flex items-center gap-2">
                        <span className="font-bold text-primary">{vinyls.length}</span>
                        <span className="text-secondary/50">records</span>
                        <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-secondary">{vinylCount} LP / {cdCount} CD</span>
                    </div>
                    <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'artist_asc' : 'newest')} className={`px-4 py-2 rounded-full border transition-colors text-sm font-medium ${sortOrder === 'artist_asc' ? 'bg-accent text-black border-accent' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>{sortOrder === 'artist_asc' ? "Sort: A-Z" : "Sort: Newest"}</button>
                    <button onClick={fetchVinyls} disabled={loading} className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white"><Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                    {!IS_STATIC && (
                        isSelectionMode ? (
                            <>
                                <button onClick={() => setSelectedIds(selectedIds.length === filteredVinyls.length ? [] : filteredVinyls.map(v => v.id))} className="px-4 py-2 text-sm text-secondary hover:text-primary border border-border rounded-full">{selectedIds.length === filteredVinyls.length ? 'Deselect All' : 'Select All'}</button>
                                <div className="flex bg-white/5 rounded-full border border-white/10 p-1">
                                    <button onClick={() => handleBatchFormatChange('Vinyl')} className="px-3 py-1 text-sm text-secondary hover:text-white hover:bg-white/10 rounded-full transition-colors">to Vinyl</button>
                                    <div className="w-px bg-white/10 my-1"></div>
                                    <button onClick={() => handleBatchFormatChange('CD')} className="px-3 py-1 text-sm text-secondary hover:text-white hover:bg-white/10 rounded-full transition-colors">to CD</button>
                                </div>
                                <button onClick={handleBatchPriceEstimate} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full text-sm"><CheckSquare className="w-4 h-4" /> Avg Price ({selectedIds.length})</button>
                                <button onClick={handleBatchFullAnalysis} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-full text-sm hover:bg-purple-500 transition-colors"><Sparkles className="w-4 h-4" /> Magic Refresh ({selectedIds.length})</button>
                                <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full text-sm"><Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})</button>
                                <button onClick={toggleSelectionMode} className="px-4 py-2 text-sm text-secondary hover:text-primary">Cancel</button>
                            </>
                        ) : (
                            <button onClick={toggleSelectionMode} className="flex items-center gap-2 bg-surface text-secondary px-4 py-2 rounded-full hover:bg-white/5 border border-border text-sm"><CheckSquare className="w-4 h-4" /> Select</button>
                        )
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="relative">
                {filteredVinyls.length === 0 && !loading && !error ? (
                    <div className="text-center py-20 text-secondary">
                        <p className="text-xl font-light">No records found.</p>
                        <p className="text-sm mt-2">Try adjusting your search or add some vinyls.</p>
                    </div>
                ) : (
                    <div className={`grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-4 transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        {visibleVinyls.map(vinyl => (
                            <VinylCard
                                key={vinyl.id}
                                vinyl={vinyl}
                                onEdit={IS_STATIC ? null : setEditingVinyl}
                                onDelete={IS_STATIC ? null : handleSingleDelete}
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

                {/* Load More Button */}
                {visibleCount < filteredVinyls.length && (
                    <div className="flex justify-center py-4">
                        <button onClick={handleLoadMore} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-secondary hover:text-white rounded-full transition-colors border border-white/10 text-sm font-medium shadow-lg hover:shadow-xl active:scale-95">
                            Load More ({filteredVinyls.length - visibleCount} remaining)
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile Selection Action Bar (Floating at bottom) */}
            {
                isSelectionMode && (
                    <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden grid grid-cols-2 gap-2 shadow-2xl animate-in slide-in-from-bottom-5">
                        <button onClick={() => handleBatchFormatChange('Vinyl')} className="bg-surface/90 backdrop-blur border border-white/10 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg">Set to Vinyl</button>
                        <button onClick={() => handleBatchFormatChange('CD')} className="bg-surface/90 backdrop-blur border border-white/10 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg">Set to CD</button>
                        <button onClick={handleBatchFullAnalysis} className="col-span-2 flex items-center justify-center gap-2 bg-purple-600/90 backdrop-blur text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg"><Sparkles className="w-4 h-4" /> Magic Refresh Metadata</button>
                        <button onClick={handleBatchPriceEstimate} className="flex items-center justify-center gap-2 bg-green-600/90 backdrop-blur text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg"><CheckSquare className="w-4 h-4" /> Estimate Price</button>
                        <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="flex items-center justify-center gap-2 bg-red-600/90 backdrop-blur text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg"><Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})</button>
                    </div>
                )
            }

            <VinylDetailModal
                vinyl={selectedDetailVinyl}
                isOpen={!!selectedDetailVinyl}
                onClose={() => setSelectedDetailVinyl(null)}
                onEdit={(v) => { setSelectedDetailVinyl(null); setEditingVinyl(v); }}
                onDelete={(id) => { setSelectedDetailVinyl(null); setTimeout(() => { handleSingleDelete(id); }, 50); }}
            />

            <EditVinylModal
                vinyl={editingVinyl}
                isOpen={!!editingVinyl}
                onClose={() => setEditingVinyl(null)}
                onUpdate={fetchVinyls}
                onDelete={(id) => { handleSingleDelete(id); setEditingVinyl(null); }}
            />
        </div >
    );
}
