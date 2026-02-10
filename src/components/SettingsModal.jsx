import React, { useState, useEffect } from 'react';
import { X, Save, Key, Cpu, Sparkles, Zap, Check, Settings, AlertTriangle, Database, Loader2, Trash2, Terminal, RefreshCw } from 'lucide-react';
import { saveApiKey, getApiKey, getProvider, setProvider, getGeminiTier, setGeminiTier, resizeImage, testConnection } from '../lib/openai';
import { pb } from '../lib/pocketbase';

export function SettingsModal({ onClose, onSave }) {
    const [apiKey, setApiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [provider, setProvider] = useState('gemini'); // gemini | openai
    const [geminiTier, setGeminiTierState] = useState('free'); // free | paid
    const [geminiModel, setGeminiModel] = useState('auto'); // auto | flash | pro | flash-2
    const [cleaning, setCleaning] = useState(false);

    useEffect(() => {
        // 1. Initial Load from LocalStorage
        const localKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
        setApiKey(localKey);
        setOpenaiKey(localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '');

        const storedProvider = localStorage.getItem('ai_provider');
        const envOpenAI = import.meta.env.VITE_OPENAI_API_KEY;
        const envGemini = import.meta.env.VITE_GEMINI_API_KEY; // local variable for check

        if (storedProvider) {
            setProvider(storedProvider);
            // Safety Check: If user is on Gemini but has no key, switch to OpenAI if available
            if (storedProvider === 'gemini' && !localStorage.getItem('gemini_api_key') && !envGemini && envOpenAI) {
                setProvider('openai');
            }
        } else if (envOpenAI) {
            setProvider('openai');
        } else {
            setProvider('gemini');
        }

        setGeminiTierState(localStorage.getItem('gemini_tier') || 'free');
        setGeminiModel(localStorage.getItem('gemini_model') || 'auto');

        // 2. AUTO-SYNC: Check Cloud (PocketBase) for API Key
        const syncKey = async () => {
            if (pb.authStore.isValid && pb.authStore.model) {
                try {
                    // Refresh user data to get latest custom fields
                    const user = await pb.collection('users').getOne(pb.authStore.model.id);

                    if (user.gemini_api_key && user.gemini_api_key.length > 10) {
                        // FOUND IN CLOUD! Update LocalStorage if different
                        if (user.gemini_api_key !== localKey) {
                            console.log("☁️ Syncing API Key from Cloud to Device...");
                            setApiKey(user.gemini_api_key);
                            localStorage.setItem('gemini_api_key', user.gemini_api_key);
                        }
                    } else if (localKey && localKey.length > 10) {
                        // FOUND LOCALLY BUT MISSING IN CLOUD! Push to Cloud
                        console.log("☁️ Pushing Local API Key to Cloud...");
                        await pb.collection('users').update(user.id, {
                            gemini_api_key: localKey
                        });
                    }
                } catch (err) {
                    console.error("Sync Error:", err);
                }
            }
        };

        // Run sync after a short delay to ensure auth is ready
        setTimeout(syncKey, 1000);

    }, []);

    const handleSave = async () => {
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('openai_api_key', openaiKey);
        localStorage.setItem('ai_provider', provider);
        localStorage.setItem('gemini_tier', geminiTier);
        localStorage.setItem('gemini_model', geminiModel);

        // CLOUD SAVE: Also update the user profile
        if (pb.authStore.isValid && pb.authStore.model && apiKey) {
            try {
                await pb.collection('users').update(pb.authStore.model.id, {
                    gemini_api_key: apiKey
                });
                console.log("✅ API Key backed up to Cloud Account");
            } catch (err) {
                console.error("Failed to backup key to cloud:", err);
            }
        }

        onClose();
    };

    const [testing, setTesting] = useState(false);
    const handleTest = async () => {
        setTesting(true);
        try {
            const keyToTest = provider === 'gemini' ? apiKey : openaiKey;
            await testConnection(provider, keyToTest);
            alert(`✅ Success! Your ${provider.toUpperCase()} key is working.`);
        } catch (e) {
            alert(`❌ Connection Failed:\n${e.message}\n\nCheck if the Key is correct and has credits/quota.`);
        } finally {
            setTesting(false);
        }
    };

    const refreshMetadata = async () => {
        if (!confirm("⚠️ RE-ANALYZE ALL?\nThis will reset all your vinyls to 'Pending' status so they can be re-scanned by AI to find TRACKS.\n\nThis might take a while. Continue?")) return;

        setCleaning(true);
        try {
            // PocketBase: Fetch all documents
            const documents = await pb.collection('vinyls').getFullList();

            // Loop updates
            const promises = documents.map(doc =>
                pb.collection('vinyls').update(doc.id, { artist: 'Pending AI', notes: null, tracks: null })
            );

            await Promise.all(promises);

            alert("All records reset! The AI will now start re-analyzing them to find tracks.");
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setCleaning(false);
        }
    };

    const [compressing, setCompressing] = useState(false);
    const [compressProgress, setCompressProgress] = useState({ current: 0, total: 0 });

    const handleCompressImages = async () => {
        if (!confirm("⚠️ COMPRESS ALL IMAGES?\nThis will download every cover, shrink it to ~300KB, and re-upload it.\n\nThis creates a backup of your images and speeds up the app.\nIt will take some time. Keep this window open.")) return;

        setCompressing(true);
        try {
            // 1. Fetch all vinyls with images
            const vinyls = await pb.collection('vinyls').getFullList({
                filter: 'image != ""',
            });

            setCompressProgress({ current: 0, total: vinyls.length });

            for (let i = 0; i < vinyls.length; i++) {
                const v = vinyls[i];
                setCompressProgress({ current: i + 1, total: vinyls.length });

                try {
                    const imageUrl = pb.files.getUrl(v, v.image);
                    // Fetch Blob
                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                    const blob = await response.blob();

                    // Skip if already small (< 500KB)
                    if (blob.size < 500 * 1024) {
                        console.log(`Skipping ${v.title} (already small: ${Math.round(blob.size / 1024)}KB)`);
                        continue;
                    }

                    // Compress
                    const compressedDataUrl = await resizeImage(blob);
                    const compressedBlob = await (await fetch(compressedDataUrl)).blob();

                    // Reconstruct File for PocketBase
                    const ext = imageUrl.split('.').pop().split('?')[0] || 'jpg';
                    const fileName = `compressed_${v.id}_${Date.now()}.${ext}`;
                    const uploadFile = new File([compressedBlob], fileName, { type: 'image/jpeg' });

                    // Upload (Update record with new image)
                    const formData = new FormData();
                    formData.append('image', uploadFile);

                    await pb.collection('vinyls').update(v.id, formData);

                } catch (err) {
                    console.error(`Failed to compress ${v.title}:`, err);
                    // Continue to next
                }
            }

            alert("Optimization Complete! All images are now compressed.");
            window.location.reload();

        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setCompressing(false);
        }
    };



    const [duplicatesPreview, setDuplicatesPreview] = useState(null); // { groups: [], totalToDelete: 0 }
    const [selectedForDeletion, setSelectedForDeletion] = useState(new Set()); // Set of IDs to delete

    const scanForDuplicates = async () => {
        setCleaning(true);
        try {
            // FETCH OPTIMIZATION: Removed server-side sort to prevent 400 Errors on large datasets
            const vinyls = await pb.collection('vinyls').getFullList({
                requestKey: null // disable auto-cancellation
            });

            // Sort client-side (Newest first) - Robust
            vinyls.sort((a, b) => {
                const dateA = a.created ? new Date(a.created).getTime() : 0;
                const dateB = b.created ? new Date(b.created).getTime() : 0;
                return dateB - dateA;
            });

            const groups = {};

            vinyls.forEach(v => {
                if (!v.artist || !v.title) return;
                if (v.artist === 'Unknown' && v.title === 'Unknown') return;

                // Group by Artist + Title + Format (so CD and Vinyl are NOT duplicates)
                const format = v.format || 'Vinyl'; // default to Vinyl if missing
                const key = `${v.artist.toLowerCase().trim()}|${v.title.toLowerCase().trim()}|${format.toLowerCase()}`;

                if (!groups[key]) groups[key] = [];
                groups[key].push(v);
            });

            // Filter only groups with duplicates
            const duplicateGroups = Object.entries(groups)
                .filter(([_, items]) => items.length > 1)
                .map(([key, items]) => {
                    // Sort items: Best to Keep -> Worst to Delete
                    items.sort((a, b) => {
                        const aScore = (a.image_url ? 2 : 0) + (a.year && a.year.length === 4 ? 2 : 0) + (a.notes && a.notes.length > 20 ? 1 : 0);
                        const bScore = (b.image_url ? 2 : 0) + (b.year && b.year.length === 4 ? 2 : 0) + (b.notes && b.notes.length > 20 ? 1 : 0);
                        if (aScore !== bScore) return bScore - aScore;
                        return new Date(a.created) - new Date(b.created); // Oldest wins logic
                    });

                    const keeper = items[0];
                    const toDelete = items.slice(1);
                    return { title: key.replace('|', ' - '), keeper, toDelete };
                });

            if (duplicateGroups.length === 0) {
                alert("No duplicates found!");
            } else {
                // Initialize selection with all duplicates selected
                const allDuplicateIds = new Set(
                    duplicateGroups.flatMap(g => g.toDelete.map(d => d.id))
                );
                setSelectedForDeletion(allDuplicateIds);
                setDuplicatesPreview(duplicateGroups);
            }

        } catch (e) {
            console.error("Scan error:", e);
            let msg = e.message;
            if (e.data) msg += "\nData: " + JSON.stringify(e.data);
            alert("Error scanning details:\n" + msg);
        } finally {
            setCleaning(false);
        }
    };

    const confirmCleanup = async () => {
        if (!duplicatesPreview) return;

        // Only delete selected items
        const idsToDelete = Array.from(selectedForDeletion);

        if (idsToDelete.length === 0) {
            alert("No duplicates selected for deletion!");
            return;
        }

        setCleaning(true);
        try {
            // Chunk deletions to avoid limits
            const chunk = 5;
            for (let i = 0; i < idsToDelete.length; i += chunk) {
                const batch = idsToDelete.slice(i, i + chunk);
                await Promise.all(batch.map(id => pb.collection('vinyls').delete(id)));
            }

            alert(`Successfully deleted ${idsToDelete.length} duplicates!`);
            window.location.reload();
        } catch (err) {
            alert("Error deleting: " + err.message);
        } finally {
            setCleaning(false);
            setDuplicatesPreview(null);
            setSelectedForDeletion(new Set());
        }
    };

    // Toggle selection of a duplicate item
    const toggleSelection = (id) => {
        setSelectedForDeletion(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Swap keeper with a duplicate
    const swapKeeper = (groupIdx, duplicateId) => {
        setDuplicatesPreview(prev => {
            const newGroups = [...prev];
            const group = newGroups[groupIdx];

            // Find the duplicate to promote
            const duplicateIdx = group.toDelete.findIndex(d => d.id === duplicateId);
            if (duplicateIdx === -1) return prev;

            const newKeeper = group.toDelete[duplicateIdx];
            const oldKeeper = group.keeper;

            // Swap them
            group.keeper = newKeeper;
            group.toDelete = [oldKeeper, ...group.toDelete.filter((_, i) => i !== duplicateIdx)];

            // Update selection: remove new keeper, add old keeper
            setSelectedForDeletion(prevSel => {
                const newSet = new Set(prevSel);
                newSet.delete(newKeeper.id);
                newSet.add(oldKeeper.id);
                return newSet;
            });

            return newGroups;
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-heavy w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-2">
                        {duplicatesPreview ? <Trash2 className="w-5 h-5 text-red-500" /> : <Settings className="w-5 h-5 text-primary" />}
                        <h2 className="text-lg font-bold text-white">
                            {duplicatesPreview ? `Review Duplicates (${duplicatesPreview.length} groups)` : 'Settings'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                {duplicatesPreview ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[70vh]">
                        <p className="text-sm text-secondary mb-2">
                            The system found {duplicatesPreview.length} duplicate groups.
                            <br /><span className="text-green-400">Green</span> = Keeping (Best Data).
                            <br /><span className="text-red-400">Red</span> = Will be deleted (uncheck to keep).
                            <br />Selected for deletion: <span className="text-yellow-400 font-bold">{selectedForDeletion.size}</span>
                        </p>

                        {duplicatesPreview.map((group, idx) => (
                            <div key={idx} className="bg-white/50 border border-slate-200 rounded-lg p-3">
                                <h3 className="text-slate-900 font-bold text-sm mb-2 capitalize">{group.title}</h3>
                                {/* Keeper */}
                                <div className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/30 rounded mb-2">
                                    <div className="flex items-center gap-4">
                                        {group.keeper.image ? (
                                            <img src={pb.files.getUrl(group.keeper, group.keeper.image)} alt="Keep" className="w-24 h-24 rounded object-cover border border-green-500/50" />
                                        ) : (
                                            <div className="w-24 h-24 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                                <span className="text-xs">No Img</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-green-400 mb-1">KEEPING</span>
                                            <div className="text-sm text-green-100">
                                                {group.keeper.year || 'No Year'} • {group.keeper.quality || 'No Quality'}
                                            </div>
                                            {group.keeper.notes && <div className="text-xs text-green-300 mt-1 line-clamp-2">{group.keeper.notes}</div>}
                                        </div>
                                    </div>
                                    <Check className="w-6 h-6 text-green-500 flex-shrink-0" />
                                </div>
                                {/* Deletions */}
                                {group.toDelete.map(d => {
                                    const isSelected = selectedForDeletion.has(d.id);
                                    return (
                                        <div key={d.id} className={`flex items-center justify-between p-2 border rounded mb-1 last:mb-0 transition-all ${isSelected
                                            ? 'bg-red-500/10 border-red-500/30 opacity-70 hover:opacity-100'
                                            : 'bg-gray-500/10 border-gray-500/30 opacity-40'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                {/* Checkbox */}
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(d.id)}
                                                    className="w-5 h-5 cursor-pointer accent-red-500"
                                                />
                                                {d.image ? (
                                                    <img src={pb.files.getUrl(d, d.image)} alt="Delete" className={`w-20 h-20 rounded object-cover border ${isSelected ? 'grayscale border-red-500/30' : 'border-gray-500/30'}`} />
                                                ) : (
                                                    <div className="w-20 h-20 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                                        <span className="text-xs text-white/30">No Img</span>
                                                    </div>
                                                )}
                                                <div className="flex flex-col flex-1">
                                                    <span className={`text-xs font-bold mb-1 ${isSelected ? 'text-red-400' : 'text-gray-400 line-through'}`}>
                                                        {isSelected ? 'DELETE' : 'KEEPING'}
                                                    </span>
                                                    <div className={`text-sm ${isSelected ? 'text-red-200' : 'text-gray-400'}`}>
                                                        {d.year || 'No Year'} • {d.quality || 'No Quality'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => swapKeeper(idx, d.id)}
                                                    className="px-2 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded text-blue-300 transition-colors"
                                                    title="Make this the keeper"
                                                >
                                                    ↑ Keep This
                                                </button>
                                                {isSelected && <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

                        {/* AI Provider Section */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">AI Service Provider</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setProvider('gemini')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${provider === 'gemini'
                                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                        : 'bg-black/20 border-white/10 text-secondary hover:bg-white/5'}`}
                                >
                                    <Sparkles className="w-6 h-6 mb-2" />
                                    <span className="text-sm font-medium">Google Gemini</span>
                                </button>
                                <button
                                    onClick={() => setProvider('openai')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${provider === 'openai'
                                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                        : 'bg-black/20 border-white/10 text-secondary hover:bg-white/5'}`}
                                >
                                    <Cpu className="w-6 h-6 mb-2" />
                                    <span className="text-sm font-medium">OpenAI GPT-4o</span>
                                </button>
                            </div>
                        </div>

                        {/* Gemini Settings */}
                        {provider === 'gemini' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Gemini API Key</label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="AIzaSy..."
                                            className="w-full bg-white/50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Account Tier (Rate Limits)</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setGeminiTierState('free')}
                                            className={`p-2 rounded-lg border text-sm font-medium transition-colors ${geminiTier === 'free' ? 'bg-primary/20 border-primary text-primary' : 'bg-black/30 border-white/10 text-secondary'}`}
                                        >
                                            Free (Lower Limits)
                                        </button>
                                        <button
                                            onClick={() => setGeminiTierState('paid')}
                                            className={`p-2 rounded-lg border text-sm font-medium transition-colors ${geminiTier === 'paid' ? 'bg-primary/20 border-primary text-primary' : 'bg-black/30 border-white/10 text-secondary'}`}
                                        >
                                            Paid (Turbo Mode)
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Preferred Model</label>
                                    <select
                                        value={geminiModel}
                                        onChange={(e) => setGeminiModel(e.target.value)}
                                        className="w-full bg-white/50 border border-slate-200 rounded-lg py-2 px-3 text-slate-900 text-sm focus:outline-none focus:border-primary"
                                    >
                                        <option value="auto">Auto (Best for Tier)</option>
                                        <option value="flash">Force Gemini 1.5 Flash (Fast)</option>
                                        <option value="pro">Force Gemini 1.5 Pro (Brainy)</option>
                                        <option value="flash-2">Force Gemini 2.0 Flash (New)</option>
                                    </select>
                                    <p className="text-[10px] text-secondary">
                                        Forces a specific model as priority. If it fails, others will still be tried.
                                    </p>
                                </div>

                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-3 text-xs text-yellow-200">
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-yellow-500" />
                                    <p>Free tier has strict rate limits (15 req/min). If analysis pauses often, this is normal.</p>
                                </div>
                            </div>
                        )}

                        {/* OpenAI Settings */}
                        {provider === 'openai' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">OpenAI API Key</label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                                        <input
                                            type="password"
                                            value={openaiKey}
                                            onChange={(e) => setOpenaiKey(e.target.value)}
                                            placeholder="sk-..."
                                            className="w-full bg-white/50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-mono"
                                        />
                                    </div>
                                    <p className="text-[10px] text-secondary">Uses <b>gpt-4o-mini</b>. Extremely fast & cheap ($0.15/1M tokens).</p>
                                </div>
                            </div>
                        )}

                        {/* Maintenance Section */}
                        <div className="pt-6 border-t border-white/10 space-y-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Database className="w-4 h-4 text-red-400" /> Maintenance
                            </h3>
                            <button
                                onClick={scanForDuplicates}
                                disabled={cleaning}
                                className="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors flex justify-center items-center gap-2 text-sm font-medium"
                            >
                                {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Clean Duplicates (Keep Best)
                            </button>
                            <p className="text-[10px] text-secondary text-center">
                                Scans for duplicates by Artist + Title. Keeps the one with most info, deletes the rest.
                            </p>

                            <button
                                onClick={refreshMetadata}
                                disabled={cleaning}
                                className="w-full p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors flex justify-center items-center gap-2 text-sm font-medium mt-4"
                            >
                                {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Update Metadata (Get Tracks)
                            </button>
                            <p className="text-[10px] text-secondary text-center">
                                Resets all records to "Pending" to re-scan them with the new AI (finds Songs/Tracks).
                            </p>

                            <button
                                onClick={handleCompressImages}
                                disabled={cleaning || compressing}
                                className={`w-full p-3 border rounded-lg transition-colors flex justify-center items-center gap-2 text-sm font-medium mt-4 ${compressing ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-green-600/10 border-green-600/30 text-green-500 hover:bg-green-600/20'}`}
                            >
                                {compressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                                {compressing ? `Compressing (${compressProgress.current}/${compressProgress.total})...` : 'Compress All Images (Optimize DB)'}
                            </button>
                            <p className="text-[10px] text-secondary text-center">
                                Reduces size of ALL existing vinyl covers to ~300KB.
                            </p>

                            <button
                                onClick={async () => {
                                    if (!confirm("Start DB Cleanup? This will convert 'USD' to '€' in all records.")) return;
                                    setCleaning(true);
                                    try {
                                        const result = await pb.collection('vinyls').getFullList();
                                        let count = 0;
                                        for (const r of result) {
                                            if (!r.average_cost) continue;
                                            let cost = String(r.average_cost);
                                            if (cost.match(/USD|U\.S\.D|Dollar|\$/i)) {
                                                // Sanitize
                                                let newCost = cost.replace(/USD|U\.S\.D|Dollar|\$/gi, "").trim();
                                                newCost = newCost.replace(/\.+$/, "").trim();
                                                if (!newCost.includes("€") && !newCost.includes("EUR")) {
                                                    if (/\d/.test(newCost)) newCost = "€" + newCost;
                                                }
                                                if (newCost.includes("EUR")) newCost = newCost.replace("EUR", "€").trim();

                                                if (newCost !== cost) {
                                                    await pb.collection('vinyls').update(r.id, { average_cost: newCost });
                                                    count++;
                                                    console.log(`Fixed ${r.id}: ${cost} -> ${newCost}`);
                                                }
                                            }
                                        }
                                        alert(`Cleanup Complete. Fixed ${count} records.`);
                                        window.location.reload();
                                    } catch (e) {
                                        console.error(e);
                                        alert("Cleanup failed: " + e.message);
                                    } finally {
                                        setCleaning(false);
                                    }
                                }}
                                disabled={cleaning}
                                className="w-full p-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors flex justify-center items-center gap-2 text-sm font-bold mt-4 shadow-lg"
                            >
                                {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Fix Currency (USD to €)
                            </button>

                            <button
                                onClick={async () => {
                                    try {
                                        const records = await pb.collection('vinyls').getList(1, 1);
                                        if (records.items.length > 0) {
                                            alert(JSON.stringify(records.items[0], null, 2));
                                        } else {
                                            alert("No vinyls found.");
                                        }
                                    } catch (e) {
                                        alert(e.message);
                                    }
                                }}
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors flex justify-center items-center gap-2 text-sm font-medium mt-4"
                            >
                                <Terminal className="w-4 h-4" /> Debug: Inspect 1st Item
                            </button>
                        </div>

                    </div>
                )}

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-2">
                    {duplicatesPreview ? (
                        <>
                            <button
                                onClick={() => setDuplicatesPreview(null)}
                                className="px-4 py-2 text-secondary hover:text-white rounded-lg text-sm transition-colors border border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCleanup}
                                disabled={cleaning || selectedForDeletion.size === 0}
                                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${selectedForDeletion.size === 0
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-500'
                                    }`}
                            >
                                {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Confirm Delete ({selectedForDeletion.size})
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleTest}
                                disabled={testing}
                                className="mr-auto flex items-center gap-2 text-secondary hover:text-white px-4 py-2 rounded-lg text-sm transition-colors border border-transparent hover:border-white/10"
                            >
                                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                {testing ? "Testing..." : "Test Key"}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 bg-primary text-black px-6 py-2 rounded-lg font-bold hover:bg-white transition-all transform hover:scale-105"
                            >
                                <Save className="w-4 h-4" /> Save
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
