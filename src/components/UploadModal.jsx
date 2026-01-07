import React, { useState, useRef, useEffect } from 'react';
import { X, Upload as UploadIcon, Loader2, Disc as ImageIcon, CheckCircle, Clock } from 'lucide-react';
import { analyzeImage, getApiKey, resizeImage } from '../lib/openai';
import { supabase } from '../lib/supabase';

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

export function UploadModal({ isOpen, onClose, onUploadComplete }) {
    if (!isOpen) return null;

    return (
        <ErrorBoundary>
            <UploadModalContent
                isOpen={isOpen}
                onClose={onClose}
                onUploadComplete={onUploadComplete}
            />
        </ErrorBoundary>
    );
}

function UploadModalContent({ isOpen, onClose, onUploadComplete }) {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({});
    const fileInputRef = useRef(null);
    const [existingFilenames, setExistingFilenames] = useState(new Set());
    const [format, setFormat] = useState('Vinyl'); // Default format

    // ENABLE LOGIC AGAIN TO CATCH THE ERROR
    useEffect(() => {
        if (isOpen) {
            setFiles([]);
            setProgress({});
            const fetchExisting = async () => {
                try {
                    const { data, error } = await supabase.from('vinyls').select('original_filename');
                    if (error) throw error;
                    if (data) {
                        setExistingFilenames(new Set(data.map(d => d.original_filename).filter(Boolean)));
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
            const isDup = existingFilenames.has(f.name) || files.some(existing => existing.name === f.name);

            if (isDup) {
                dupCount++;
                // Strict Blocking: Do not add to files list
                return;
            }

            newFiles.push(f);
            newProgress[f.name] = {
                status: 'pending',
                progress: 0,
                error: null
            };
        });

        if (dupCount > 0) {
            alert(`Skipped ${dupCount} duplicate file(s) that are already in your library.`);
        }

        if (newFiles.length > 0) {
            setFiles(prev => [...prev, ...newFiles]);
            setProgress(newProgress);
        }

        e.target.value = '';
    };

    const processUploads = async () => {
        setUploading(true);
        const apiKey = getApiKey();
        const uploadedRecords = [];

        // Helper for synchronous analysis with retry
        // Renamed to reflect its blocking nature in the current flow
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Skip if already done
                if (progress[file.name]?.status === 'complete' && progress[file.name]?.dbId) {
                    uploadedRecords.push({ id: progress[file.name].dbId, file, name: file.name });
                    continue;
                }

                try {
                    setProgress(prev => ({ ...prev, [file.name]: { status: 'uploading', progress: 10, error: null } }));

                    // 1. Upload to Storage
                    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

                    // COMPRESS: Client-Side Resize to prevent OOM on Grid
                    const compressedDataUrl = await resizeImage(file);
                    const compressedBlob = await (await fetch(compressedDataUrl)).blob();

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('covers')
                        .upload(fileName, compressedBlob, {
                            contentType: 'image/jpeg',
                            upsert: false
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('covers')
                        .getPublicUrl(fileName);

                    // 2. Insert to DB (Pending State)
                    const { data: dbData, error: dbError } = await supabase
                        .from('vinyls')
                        .insert({
                            image_url: publicUrl,
                            artist: 'Pending AI',
                            title: file.name.replace(/\.[^/.]+$/, ""), // Use filename as tentative title
                            genre: '',
                            year: '',
                            original_filename: file.name // Track for deduplication
                        })
                        .select()
                        .single();

                    if (dbError) throw dbError;

                    uploadedRecords.push({ id: dbData.id, file, name: file.name, publicUrl });




                    // 3. Instant Finish (Handover to Background Banner)
                    // We simply finish here. The BatchAnalysisBanner in the grid will detect
                    // the 'Pending AI' items and process them in the background queue.
                    // This allows "Caricare molti file" without blocking the UI.

                    // Show as "Saved" - Complete
                    setProgress(prev => ({
                        ...prev,
                        [file.name]: { status: 'complete', progress: 100, dbId: dbData.id, publicUrl }
                    }));

                } catch (err) {
                    console.error("Upload failed:", err);
                    setProgress(prev => ({
                        ...prev,
                        [file.name]: { status: 'error', progress: 0, error: "Upload failed: " + err.message }
                    }));
                }
            }
            // END OF UPLOAD LOOP - No Phase 2


        } catch (e) {
            console.error("Upload error:", e);
        } finally {
            setUploading(false);
            onUploadComplete();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <UploadIcon className="w-5 h-5 text-primary" /> Upload {format}s
                    </h2>
                    <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
                        <button onClick={() => setFormat('Vinyl')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${format === 'Vinyl' ? 'bg-primary text-black shadow-lg' : 'text-secondary hover:text-white'}`}>Vinyl</button>
                        <button onClick={() => setFormat('CD')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${format === 'CD' ? 'bg-primary text-black shadow-lg' : 'text-secondary hover:text-white'}`}>CD</button>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors" disabled={uploading}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {files.length === 0 ? (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors group">
                            <div className="bg-primary/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform"><UploadIcon className="w-8 h-8 text-primary" /></div>
                            <p className="text-lg font-medium">Click to upload or drag and drop</p>
                            <p className="text-secondary text-sm mt-2">Support for JPG, PNG</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {files.map(file => {
                                const status = progress[file.name] || { status: 'pending', progress: 0 };
                                return (
                                    <div key={file.name} className="flex items-center gap-4 bg-background p-3 rounded-lg border border-border">
                                        <div className="w-10 h-10 bg-white/5 rounded flex items-center justify-center flex-shrink-0"><ImageIcon className="w-5 h-5 text-secondary" /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{file.name}</p>
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
                                            {(status.status === 'uploading' || status.status === 'analyzing' || status.status === 'saving') && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                                            {(status.status === 'retrying' || status.status === 'duplicate_warning') && <Loader2 className={`w-5 h-5 ${status.status === 'retrying' ? 'animate-spin' : ''} text-yellow-500`} />}
                                        </div>
                                    </div>
                                );
                            })}
                            <button onClick={() => fileInputRef.current?.click()} className="text-sm text-primary hover:underline mt-2" disabled={uploading}>+ Add more files</button>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />
                </div>

                <div className="p-4 border-t border-border flex justify-between items-center gap-2">
                    {files.length > 0 && (
                        <button onClick={processUploads} disabled={uploading || files.every(f => progress[f.name]?.status === 'complete')} className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Start Upload'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
