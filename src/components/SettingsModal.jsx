import React, { useState, useEffect } from 'react';
import { X, Save, Key, Cpu, Sparkles, Zap, Check, Settings, AlertTriangle, Database, Loader2, Trash2, Terminal } from 'lucide-react';
import { saveApiKey, getApiKey, getProvider, setProvider, getGeminiTier, setGeminiTier, resizeImage } from '../lib/openai';
import { databases, storage, DATABASE_ID, BUCKET_ID } from '../lib/appwrite';
import { Query } from 'appwrite';

export function SettingsModal({ onClose, onSave }) {
    const [apiKey, setApiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [provider, setProvider] = useState('gemini'); // gemini | openai
    const [geminiTier, setGeminiTierState] = useState('free'); // free | paid
    const [geminiModel, setGeminiModel] = useState('auto'); // auto | flash | pro | flash-2
    const [cleaning, setCleaning] = useState(false);

    useEffect(() => {
        setApiKey(localStorage.getItem('gemini_api_key') || '');
        setOpenaiKey(localStorage.getItem('openai_api_key') || '');
        setProvider(localStorage.getItem('ai_provider') || 'gemini');
        setGeminiTierState(localStorage.getItem('gemini_tier') || 'free');
        setGeminiModel(localStorage.getItem('gemini_model') || 'auto');
    }, []);

    const handleSave = () => {
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('openai_api_key', openaiKey);
        localStorage.setItem('ai_provider', provider);
        localStorage.setItem('gemini_tier', geminiTier);
        localStorage.setItem('gemini_model', geminiModel);

        onSave();
        onClose();
    };

    const refreshMetadata = async () => {
        if (!confirm("⚠️ RE-ANALYZE ALL?\nThis will reset all your vinyls to 'Pending' status so they can be re-scanned by AI to find TRACKS.\n\nThis might take a while. Continue?")) return;

        setCleaning(true);
        try {
            // Appwrite: Fetch all documents first
            const { documents } = await databases.listDocuments(
                DATABASE_ID,
                'vinyls',
                [Query.limit(1000)]
            );

            // Loop updates (Appwrite doesn't have bulk update)
            const promises = documents.map(doc =>
                databases.updateDocument(
                    DATABASE_ID,
                    'vinyls',
                    doc.$id,
                    { artist: 'Pending AI', notes: null, tracks: null }
                )
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
            // 1. Fetch all vinyls
            const { documents: vinyls } = await databases.listDocuments(
                DATABASE_ID,
                'vinyls',
                [Query.isNotNull('image_url'), Query.limit(1000)]
            );

            setCompressProgress({ current: 0, total: vinyls.length });

            for (let i = 0; i < vinyls.length; i++) {
                const v = vinyls[i];
                setCompressProgress({ current: i + 1, total: vinyls.length });

                try {
                    // Fetch Blob
                    const response = await fetch(v.image_url);
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

                    // Reconstruct File for Appwrite
                    const ext = v.image_url.split('.').pop().split('?')[0] || 'jpg';
                    const fileName = `compressed_${v.$id}_${Date.now()}.${ext}`;
                    const uploadFile = new File([compressedBlob], fileName, { type: 'image/jpeg' });

                    // Upload
                    const fileUpload = await storage.createFile(
                        BUCKET_ID,
                        'unique()',
                        uploadFile
                    );

                    // Get Public URL
                    const publicUrl = storage.getFileView(BUCKET_ID, fileUpload.$id).href;


                    // Update DB
                    await databases.updateDocument(
                        DATABASE_ID,
                        'vinyls',
                        v.$id,
                        { image_url: publicUrl }
                    );

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



    const cleanupDuplicates = async () => {
        if (!confirm("⚠️ This will search and DELETE duplicate vinyls (same Artist + Title).\nIt will keep the one with the best data and delete the others.\n\nContinue?")) return;

        setCleaning(true);
        try {
            const { documents: vinyls } = await databases.listDocuments(
                DATABASE_ID,
                'vinyls',
                [Query.isNotNull('artist'), Query.isNotNull('title'), Query.limit(1000)]
            );

            const groups = {};
            const toDelete = [];

            vinyls.forEach(v => {
                if (!v.artist || !v.title) return;
                // Skip if both are "Unknown" (risk of false positive on unanalyzed)
                if (v.artist === 'Unknown' && v.title === 'Unknown') return;

                const key = `${v.artist.toLowerCase().trim()}|${v.title.toLowerCase().trim()}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(v);
            });

            Object.values(groups).forEach(group => {
                if (group.length > 1) {
                    // Sort to find best keeper:
                    // Priority: Has Image > Valid Year > Notes > Oldest
                    group.sort((a, b) => {
                        const aScore = (a.image_url ? 2 : 0) + (a.year && a.year.length === 4 ? 2 : 0) + (a.notes && a.notes.length > 20 ? 1 : 0);
                        const bScore = (b.image_url ? 2 : 0) + (b.year && b.year.length === 4 ? 2 : 0) + (b.notes && b.notes.length > 20 ? 1 : 0);
                        if (aScore !== bScore) return bScore - aScore; // Higher score wins
                        return new Date(a.$createdAt) - new Date(b.$createdAt); // Oldest wins - Appwrite timestamp is $createdAt
                    });

                    // Keep [0], delete rest
                    const losers = group.slice(1);
                    losers.forEach(l => toDelete.push(l.$id));
                }
            });

            if (toDelete.length > 0) {
                const deletePromises = toDelete.map(id =>
                    databases.deleteDocument(DATABASE_ID, 'vinyls', id)
                );
                await Promise.all(deletePromises);

                alert(`Successfully removed ${toDelete.length} duplicate vinyls!`);
                window.location.reload();
            } else {
                alert("No duplicates found!");
            }

        } catch (e) {
            console.error(e);
            alert("Error cleaning duplicates: " + e.message);
        } finally {
            setCleaning(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold text-white">Settings</h2>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
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
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-mono"
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
                                    className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-primary"
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
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-mono"
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
                            onClick={cleanupDuplicates}
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
                                try {
                                    const { documents } = await databases.listDocuments(DATABASE_ID, 'vinyls', [Query.limit(1)]);
                                    if (documents.length > 0) {
                                        alert(JSON.stringify(documents[0], null, 2));
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

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-primary text-black px-6 py-2 rounded-lg font-bold hover:bg-white transition-all transform hover:scale-105"
                    >
                        <Save className="w-4 h-4" /> Save
                    </button>
                </div>
            </div>
        </div>
    );
}
