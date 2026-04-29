import React, { useState, useRef, useEffect } from 'react';
import { X, Upload as UploadIcon, Loader2, Disc as ImageIcon, CheckCircle, Clock, Camera, Bug, Search as SearchIcon, Globe, Plus, ScanLine } from 'lucide-react';
import { analyzeImage, getApiKey, resizeImage } from '../lib/openai';
import { pb } from '../lib/pocketbase';
import { BarcodeScanner } from './BarcodeScanner';

// Error Boundary for debugging
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("UploadModal Crash:", error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-900/90 text-white p-8">
                    <div className="max-w-2xl w-full bg-black p-6 rounded-xl border-2 border-red-500 shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 text-red-500 flex items-center gap-2">
                            CRASH DETECTED
                        </h2>
                        <div className="bg-red-950 p-4 rounded-lg overflow-auto max-h-[60vh]">
                            <p className="font-mono text-sm whitespace-pre-wrap text-red-200">
                                {this.state.error && this.state.error.toString()}
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export function UploadModal({ isOpen, onClose, onUploadComplete, onOpenDebug }) {
    if (!isOpen) return null;

    return (
        <ErrorBoundary>
            <UploadModalContent
                isOpen={isOpen}
                onClose={onClose}
                onUploadComplete={onUploadComplete}
                onOpenDebug={onOpenDebug}
            />
        </ErrorBoundary>
    );
}

function UploadModalContent({ isOpen, onClose, onUploadComplete, onOpenDebug }) {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({});
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [existingFilenames, setExistingFilenames] = useState(new Set());
    const [format, setFormat] = useState('Vinyl'); // Default format
    const [isWantlist, setIsWantlist] = useState(false);
    const [tab, setTab] = useState('upload'); // 'upload' or 'music'
    const [musicQuery, setMusicQuery] = useState('');
    const [musicResults, setMusicResults] = useState([]);
    const [searchingMusic, setSearchingMusic] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const formatRef = useRef('Vinyl');
    const isWantlistRef = useRef(false);
    const abortRef = useRef(false);

    // Keep ref in sync
    useEffect(() => {
        formatRef.current = format;
    }, [format]);

    useEffect(() => {
        isWantlistRef.current = isWantlist;
    }, [isWantlist]);

    // ENABLE LOGIC AGAIN TO CATCH THE ERROR
    useEffect(() => {
        if (isOpen) {
            setFiles([]);
            setProgress({});
            const fetchExisting = async () => {
                try {
                    // PocketBase list
                    const records = await pb.collection('vinyls').getList(1, 1000, {
                        fields: 'original_filename',
                    });

                    if (records.items) {
                        setExistingFilenames(new Set(records.items.map(d => d.original_filename).filter(Boolean)));
                    }
                } catch (err) {
                    console.error("Failed to check duplicates:", err);
                    setExistingFilenames(new Set());
                }
            };
            fetchExisting();
        }
    }, [isOpen]);

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const newProgress = { ...progress };
        const newFiles = [];
        let dupCount = 0;

        selectedFiles.forEach(f => {
            // REMOVED: Strict duplicate checking on filename.
            // It caused issues with generic camera filenames (IMG_XXXX) or re-uploads.
            // const isDup = existingFilenames.has(f.name) || files.some(existing => existing.name === f.name);

            newFiles.push(f);
            newProgress[f.name] = {
                status: 'pending',
                progress: 0,
                error: null
            };
        });

        // if (dupCount > 0) { ... }

        if (newFiles.length > 0) {
            setFiles(prev => [...prev, ...newFiles]);
            setProgress(newProgress);
        }

        e.target.value = '';
    };

    // Handle closing/reset
    const handleClose = () => {
        if (uploading) {
            if (confirm("Upload in progress. Stop uploads?")) {
                abortRef.current = true;
                onClose();
            }
        } else {
            onClose();
        }
    };

    const processUploads = async () => {
        setUploading(true);
        abortRef.current = false; // Reset abort flag
        const apiKey = getApiKey();
        const uploadedRecords = [];

        // DEBUG ALERT
        console.log(`Starting upload of ${files.length} files...`);

        try {
            for (let i = 0; i < files.length; i++) {
                // Check Abort Flag
                if (abortRef.current) {
                    console.log("Upload aborted by user.");
                    break;
                }

                const file = files[i];

                // Skip if already done
                if (progress[file.name]?.status === 'complete' && progress[file.name]?.dbId) {
                    uploadedRecords.push({ id: progress[file.name].dbId, file, name: file.name });
                    continue;
                }

                try {
                    // Use ref to guarantee freshness
                    const currentFormat = formatRef.current;
                    console.log(`Uploading ${file.name} with format: ${currentFormat}`);

                    // 0. PREPARE: Client-Side Resize FIRST (Crucial for performance)
                    setProgress(prev => ({ ...prev, [file.name]: { status: 'preparing', progress: 5, error: null } }));
                    console.log(`Preparing ${file.name}...`);

                    let optimizedFile = file;
                    try {
                        const compressedDataUrl = await resizeImage(file);
                        const compressedBlob = await (await fetch(compressedDataUrl)).blob();
                        
                        // V36.1: CRITICAL - Ensure filename reflects the new JPEG content
                        // Replace .heic/.heif extensions with .jpg to unblock OpenAI
                        let newName = file.name;
                        if (newName.toLowerCase().endsWith('.heic') || newName.toLowerCase().endsWith('.heif')) {
                            newName = newName.replace(/\.(heic|heif)$/i, '.jpg');
                            console.log(`[V36.1] Renaming ${file.name} to ${newName} for OpenAI compatibility`);
                        }
                        
                        optimizedFile = new File([compressedBlob], newName, { type: 'image/jpeg' });
                        console.log(`Resized ${file.name} to ${(optimizedFile.size / 1024 / 1024).toFixed(2)}MB`);
                        // DEBUG ALERT
                        // alert(`Resized successfully: ${(optimizedFile.size / 1024 / 1024).toFixed(2)}MB`);
                    } catch (resizeErr) {
                        console.warn(`Resize failed for ${file.name}, using original:`, resizeErr);
                        // If resize fails (e.g. memory issue on mobile), try with original file
                        // This is risky but better than crashing
                        if (file.size > 5 * 1024 * 1024) { // > 5MB
                            throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use a smaller image or try from desktop.`);
                        }
                    }

                    // 1. SKIP AI Analysis During Upload (User will trigger manually via BatchAnalysisBanner)
                    // This allows fast photo uploads without waiting for AI processing
                    setProgress(prev => ({ ...prev, [file.name]: { status: 'uploading', progress: 20, error: null } }));

                    let aiMetadata = {};
                    // AI Analysis is now DISABLED during upload for faster performance
                    // Users can trigger batch analysis after upload via the banner
                    /* DISABLED - AI Analysis moved to manual trigger
                    try {
                        if (apiKey) {
                            // Smart Hint: Use filename if it's not generic (IMG_XXXX)
                            let hint = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
                            if (/^(IMG|DSC|PXL|VIDEO|MOV|VID)[\d_-]/i.test(hint) || hint.length < 4) {
                                hint = null; // Ignore generic camera filenames
                            }

                            const aiPromise = analyzeImage(optimizedFile, hint);
                            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AI Timeout (30s)")), 30000));

                            aiMetadata = await Promise.race([aiPromise, timeoutPromise]);
                            console.log("✅ AI Analysis Success:", aiMetadata);
                            console.log(`📊 Metadata completeness: ${Object.keys(aiMetadata).filter(k => aiMetadata[k] && aiMetadata[k] !== 'Unknown').length}/${Object.keys(aiMetadata).length} fields`);
                        } else {
                            console.log("No API Key, skipping AI analysis.");
                        }
                    } catch (aiErr) {
                        console.warn("AI Analysis skipped:", aiErr);
                        // Don't verify or stop, just continue to upload
                    }
                    */

                    // 2. Upload to PB (Create Record with File)
                    setProgress(prev => ({ ...prev, [file.name]: { status: 'uploading', progress: 50, error: null } }));

                    const formData = new FormData();
                    formData.append('image', optimizedFile);

                    // Add Metadata
                    const metadata = {
                        // Since AI is skipped, mark as 'Pending AI' for batch processing later
                        artist: 'Pending AI',
                        title: String(aiMetadata.title || file.name.replace(/\.[^/.]+$/, "")).substring(0, 100),
                        genre: String(aiMetadata.genre || '').substring(0, 50),
                        year: String(aiMetadata.year || '').substring(0, 50),
                        notes: String(aiMetadata.notes || '').substring(0, 1000),
                        tracks: String(aiMetadata.tracks || '').substring(0, 5000),
                        group_members: String(aiMetadata.group_members || '').substring(0, 255),
                        condition: String(aiMetadata.condition || '').substring(0, 50),
                        average_cost: String(aiMetadata.average_cost || '').substring(0, 50),
                        // CRITICAL: Save AI-analyzed fields that were previously missing
                        label: String(aiMetadata.label || '').substring(0, 100),
                        edition: String(aiMetadata.edition || '').substring(0, 100),
                        catalog_number: String(aiMetadata.catalog_number || '').substring(0, 50),
                        original_filename: file.name,
                        format: currentFormat,
                        is_wantlist: isWantlistRef.current
                    };

                    for (const [key, value] of Object.entries(metadata)) {
                        formData.append(key, value);
                    }

                    // 3. Insert to DB
                    setProgress(prev => ({ ...prev, [file.name]: { status: 'saving', progress: 80, error: null } }));

                    const record = await pb.collection('vinyls').create(formData);
                    const publicUrl = pb.files.getUrl(record, record.image);

                    // DEBUG ALERT
                    // alert(`Saved to DB! ID: ${record.id}`);

                    uploadedRecords.push({ id: record.id, file, name: file.name, publicUrl });

                    // 4. Complete
                    setProgress(prev => ({
                        ...prev,
                        [file.name]: { status: 'complete', progress: 100, dbId: record.id, publicUrl }
                    }));

                } catch (err) {
                    console.error("Upload failed:", err);
                    setProgress(prev => ({
                        ...prev,
                        [file.name]: { status: 'error', progress: 0, error: "Error: " + err.message }
                    }));
                    // DEBUG ALERT
                    alert(`Upload FAILED for ${file.name}: ${err.message}`);
                }
            }
        } catch (e) {
            console.error("Upload error:", e);
        } finally {
            setUploading(false);
            // Trigger refresh and close modal after upload
            onUploadComplete();
            // Close modal after a short delay to show completion
            setTimeout(() => {
                onClose();
            }, 500);
        }
    };

    const handleSearchMusic = async (e, explicitQuery = null) => {
        if (e && e.preventDefault) e.preventDefault();
        const queryToUse = explicitQuery || musicQuery;
        if (!queryToUse.trim()) return;

        setSearchingMusic(true);
        setMusicResults([]);
        try {
            const res = await fetch(`/api/music/search?q=${encodeURIComponent(queryToUse)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Search failed');

            setMusicResults(data.results || []);
        } catch (err) {
            console.error("Music search error:", err);
            alert(`Search error: ${err.message}`);
        } finally {
            setSearchingMusic(false);
        }
    };

    const handleAddFromMusic = async (release) => {
        setUploading(true);
        try {
            const formData = new FormData();

            formData.append('title', String(release.title || 'Unknown Title').substring(0, 100));
            formData.append('artist', String(release.artist || 'Unknown Artist').substring(0, 100));
            formData.append('year', String(release.year || '').substring(0, 50));
            formData.append('genre', Array.isArray(release.genre) ? release.genre.join(', ').substring(0, 50) : '');
            formData.append('label', Array.isArray(release.label) ? String(release.label[0]).substring(0, 100) : '');
            formData.append('catalog_number', '');

            formData.append('format', formatRef.current);
            formData.append('is_wantlist', isWantlistRef.current);
            formData.append('notes', 'Imported from Apple Music');

            if (release.thumb && !release.thumb.endsWith('spacer.gif')) {
                try {
                    const imgRes = await fetch(release.thumb);
                    const blob = await imgRes.blob();
                    formData.append('image', new File([blob], 'music_cover.jpg', { type: 'image/jpeg' }));
                } catch (imgErr) {
                    console.warn("Failed to download cover", imgErr);
                }
            }

            await pb.collection('vinyls').create(formData);

            onUploadComplete();
            setTimeout(() => {
                onClose();
            }, 500);

        } catch (err) {
            console.error("Failed to add from Music DB", err);
            alert("Error adding record: " + err.message);
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-heavy rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex flex-col gap-4 p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2 shrink-0">
                            <UploadIcon className="w-5 h-5 text-primary" /> Add items
                        </h2>
                        <div className="flex items-center gap-2">
                            {onOpenDebug && tab === 'upload' && (
                                <button onClick={onOpenDebug} className="p-2 text-danger/50 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors" title="Debug Tools">
                                    <Bug className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        {/* Tab Switcher */}
                        <div className="flex bg-black/20 rounded-lg p-1 border border-white/10 shrink-0 w-full md:w-auto">
                            <button onClick={() => setTab('upload')} className={`flex-1 md:flex-none justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${tab === 'upload' ? 'bg-white/10 text-white shadow-lg' : 'text-secondary hover:text-white'}`}><UploadIcon className="w-4 h-4" /> Upload</button>
                            <button onClick={() => setTab('music')} className={`flex-1 md:flex-none justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${tab === 'music' ? 'bg-white/10 text-white shadow-lg' : 'text-secondary hover:text-white'}`}><Globe className="w-4 h-4" /> Apple Music</button>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto md:ml-auto">
                            <div className="flex flex-1 md:flex-none bg-black/20 rounded-lg p-1 border border-white/10 shrink-0">
                                <button onClick={() => setFormat('Vinyl')} className={`flex-1 md:flex-none justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${format === 'Vinyl' ? 'bg-primary text-black shadow-lg' : 'text-secondary hover:text-white'}`}>Vinyl</button>
                                <button onClick={() => setFormat('CD')} className={`flex-1 md:flex-none justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${format === 'CD' ? 'bg-primary text-black shadow-lg' : 'text-secondary hover:text-white'}`}>CD</button>
                            </div>
                            <div className="flex flex-1 md:flex-none bg-purple-900/20 rounded-lg p-1 border border-purple-500/20 shrink-0">
                                <button onClick={() => setIsWantlist(false)} className={`flex-1 md:flex-none justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!isWantlist ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-300 hover:text-white'}`}>Collection</button>
                                <button onClick={() => setIsWantlist(true)} className={`flex-1 md:flex-none justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${isWantlist ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-300 hover:text-white'}`}>Wantlist</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {tab === 'music' ? (
                        <div className="space-y-6">
                            <form onSubmit={(e) => handleSearchMusic(e)} className="relative">
                                <input
                                    type="text"
                                    value={musicQuery}
                                    onChange={(e) => setMusicQuery(e.target.value)}
                                    placeholder="Search Apple Music by artist, album..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <button
                                    type="submit"
                                    disabled={searchingMusic || !musicQuery.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-black px-4 py-1.5 rounded-lg font-bold text-sm disabled:opacity-50"
                                >
                                    {searchingMusic ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                                </button>
                            </form>

                            <button
                                type="button"
                                onClick={() => setIsScanning(true)}
                                className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl px-4 py-3 transition-colors"
                            >
                                <ScanLine className="w-5 h-5" />
                                Scan Barcode using Camera
                            </button>

                            {musicResults.length > 0 && (
                                <div className="space-y-3">
                                    {musicResults.map((release, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 hover:border-primary/50 transition-colors">
                                            {release.thumb && !release.thumb.endsWith('spacer.gif') && (
                                                <div className="w-16 h-16 bg-black/50 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                                    <img src={release.thumb} alt="cover" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-white text-lg leading-tight">{release.title}</h4>
                                                <p className="text-primary font-medium mb-1">{release.artist}</p>
                                                <p className="text-sm text-secondary flex flex-wrap gap-2 mt-2">
                                                    {release.year && <span className="bg-white/10 px-2 py-0.5 rounded">{release.year}</span>}
                                                    {Array.isArray(release.label) && <span className="bg-white/10 px-2 py-0.5 rounded">{release.label[0]}</span>}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleAddFromMusic(release)}
                                                disabled={uploading}
                                                className="shrink-0 p-3 bg-white/10 hover:bg-primary hover:text-black text-white rounded-xl transition-all"
                                                title="Import"
                                            >
                                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!searchingMusic && musicResults.length === 0 && musicQuery && (
                                <p className="text-center text-white/40 mt-8 mb-8">No results found on Apple Music.</p>
                            )}
                        </div>
                    ) : (
                        files.length === 0 ? (
                            <div className="flex flex-col gap-4">
                                {/* Standard Drop/Click Area */}
                                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors group">
                                    <div className="bg-primary/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform"><UploadIcon className="w-8 h-8 text-primary" /></div>
                                    <p className="text-lg font-medium">Click to upload or drag and drop</p>
                                    <p className="text-secondary text-sm mt-2">Support for JPG, PNG</p>
                                </div>

                                {/* Camera Button */}
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    <Camera className="w-6 h-6 text-accent" />
                                    <span className="font-medium">Take Photo with Camera</span>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {files.map(file => {
                                    const status = progress[file.name] || { status: 'pending', progress: 0 };
                                    return (
                                        <div key={file.name} className="flex items-center gap-4 bg-white/50 p-3 rounded-lg border border-slate-200">
                                            <div className="w-10 h-10 bg-white/50 rounded flex items-center justify-center flex-shrink-0"><ImageIcon className="w-5 h-5 text-secondary" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate text-slate-900">{file.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                                        <div className={`h-full transition-all duration-300 ${status.status === 'error' ? 'bg-red-500' : status.status === 'retrying' || status.status === 'queued' ? 'bg-yellow-500' : 'bg-primary'}`} style={{ width: `${status.progress}%` }} />
                                                    </div>
                                                    <span className={`text-xs w-16 text-right capitalize ${status.status === 'error' ? 'text-red-400' : status.status === 'retrying' || status.status === 'queued' ? 'text-yellow-400' : 'text-secondary'}`}>{status.status === 'duplicate_warning' ? 'Warning' : status.status}</span>
                                                </div>
                                                {status.error && <p className={`text-xs mt-1 ${status.status === 'retrying' || status.status === 'queued' ? 'text-yellow-400' : 'text-red-400'}`}>{status.error}</p>}
                                            </div>
                                            <div className="w-6 flex justify-center">
                                                {status.status === 'complete' && <CheckCircle className="w-5 h-5 text-green-500" />}
                                                {status.status === 'queued' && <Clock className="w-5 h-5 text-yellow-500" />}
                                                {status.status === 'error' && <X className="w-5 h-5 text-red-500" />}
                                                {(status.status === 'uploading' || status.status === 'analyzing' || status.status === 'saving' || status.status === 'preparing') && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                                                {(status.status === 'retrying' || status.status === 'duplicate_warning') && <Loader2 className={`w-5 h-5 ${status.status === 'retrying' ? 'animate-spin' : ''} text-yellow-500`} />}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => fileInputRef.current?.click()} className="text-sm text-primary hover:underline" disabled={uploading}>+ Add more files</button>
                                    <span className="text-white/20">|</span>
                                    <button onClick={() => cameraInputRef.current?.click()} className="text-sm text-accent hover:underline flex items-center gap-1" disabled={uploading}><Camera className="w-3 h-3" /> Take Photo</button>
                                </div>
                            </div>
                        )
                    )}
                    {/* V35.6: STRETTA SUI FORMATI PER FORZARE LA TRANSCODIFICA DI IOS - BYPASS DI SAFARI */}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/jpeg, image/png, image/webp" className="hidden" />
                    <input type="file" ref={cameraInputRef} onChange={handleFileSelect} accept="image/jpeg, image/png, image/webp" capture="environment" className="hidden" />
                </div>

                <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5 rounded-b-xl">
                    <button onClick={handleClose} className="px-4 py-2 text-secondary hover:text-white transition-colors" disabled={uploading && !abortRef.current}>
                        Cancel
                    </button>
                    {uploading ? (
                        <button
                            onClick={() => abortRef.current = true}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Stop
                        </button>
                    ) : (
                        tab === 'upload' && (
                            <button
                                onClick={processUploads}
                                disabled={files.length === 0}
                                className="bg-primary hover:bg-primary/90 text-black px-6 py-2 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                {files.length > 0 ? `Upload ${files.length} Files` : 'Upload'}
                            </button>
                        )
                    )}
                </div>
            </div>

            {
                isScanning && (
                    <BarcodeScanner
                        onScan={(decodedText) => {
                            setIsScanning(false);
                            setMusicQuery(decodedText);
                            handleSearchMusic(null, decodedText); // Auto search!
                        }}
                        onClose={() => setIsScanning(false)}
                    />
                )
            }
        </div >
    );
}
