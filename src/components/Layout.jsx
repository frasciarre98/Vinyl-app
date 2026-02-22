import React, { useState, useEffect } from 'react';
import { Settings, Plus, Download, Loader2, Bug, Globe, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { VinylLogo } from './VinylLogo';
import { pb } from '../lib/pocketbase';
import { ImportModal } from './ImportModal';

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true';

export function Layout({ children, onOpenSettings, onOpenUpload, onOpenDebug }) {
    const [isExporting, setIsExporting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    // User state can be used if we want to show profile/logout in the header
    const [user, setUser] = useState(pb.authStore.model);

    useEffect(() => {
        return pb.authStore.onChange((token, model) => {
            setUser(model);
        });
    }, []);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // PocketBase: getFullList
            const data = await pb.collection('vinyls').getFullList();

            if (!data || data.length === 0) {
                alert('No vinyls to export!');
                return;
            }

            // CSV Headers (Semicolon for Excel compatibility in IT/EU)
            const headers = [
                'ID', 'Title', 'Artist', 'Year', 'Genre', 'Group Members',
                'Condition', 'Format', 'Rating', 'Label', 'Catalog No.',
                'Edition / Variant', 'Average Cost', 'Purchase Price',
                'Purchase Year', 'Price Locked', 'Tracks Validated',
                'Locked Fields', 'Notes', 'Tracks'
            ];
            // Convert data to CSV format
            const csvRows = [
                headers.join(';'), // Header row
                ...data.map(row => {
                    return [
                        `"${row.id}"`,
                        `"${String(row.title || '').replace(/"/g, '""')}"`,
                        `"${String(row.artist || '').replace(/"/g, '""')}"`,
                        `"${String(row.year || '').replace(/"/g, '""')}"`,
                        `"${String(row.genre || '').replace(/"/g, '""')}"`,
                        `"${String(row.group_members || '').replace(/"/g, '""')}"`,
                        `"${String(row.condition || '').replace(/"/g, '""')}"`,
                        `"${String(row.format || 'Vinyl').replace(/"/g, '""')}"`,
                        `"${row.rating || 0}"`,
                        `"${String(row.label || '').replace(/"/g, '""')}"`,
                        `"${String(row.catalog_number || '').replace(/"/g, '""')}"`,
                        `"${String(row.edition || '').replace(/"/g, '""')}"`,
                        `"${String(row.avarege_cost || row.average_cost || '').replace(/"/g, '""')}"`,
                        `"${String(row.purchase_price || '').replace(/"/g, '""')}"`,
                        `"${String(row.purchase_year || '').replace(/"/g, '""')}"`,
                        `"${row.is_price_locked ? 'Yes' : 'No'}"`,
                        `"${row.is_tracks_validated ? 'Yes' : 'No'}"`,
                        `"${(Array.isArray(row.locked_fields) ? row.locked_fields : []).join(', ')}"`,
                        `"${String(row.notes || '').replace(/"/g, '""')}"`,
                        `"${String(row.tracks || '').replace(/"/g, '""').replace(/\n/g, ', ')}"`
                    ].join(';');
                })
            ];

            const csvContent = csvRows.join('\n');
            // Add BOM for Excel UTF-8 recognition
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `vinyl_catalog_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Export failed:', err);
            alert(`Export failed: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handlePublish = async () => {
        if (!confirm("🚀 MAGIC PUBLISH\n\nThis will export your current collection (data + images) and push it to GitHub/Vercel.\n\nContinue?")) return;

        // Check if we are running on the NAS (or any non-localhost production environment)
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            alert("⚠️ MAGIC PUBLISH LIMITATION\n\nSince the app is now running on your NAS, it doesn't have access to your Mac's 'Git' commands or GitHub credentials to upload the site.\n\nTo publish the NAS data to Vercel, open the terminal on your MAC (inside the ionized-hubble folder) and run:\n\nVITE_PB_URL=http://192.168.0.250:8090 npm run export:static && git add . && git commit -m 'Auto-publish' && git push");
            return;
        }

        setIsPublishing(true);
        try {
            const res = await fetch('/api/publish');

            // Catch HTML fallback responses immediately
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") === -1) {
                throw new Error("Server did not return JSON. The publish endpoint is not running.");
            }

            const data = await res.json();
            if (data.success) {
                alert("✨ PUBLISHED!\n\nYour collection has been sent to GitHub. Vercel will update the site in 1-2 minutes.");
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            console.error('Publish failed:', err);
            alert(`❌ PUBLISH FAILED\n\n${err.message}\n\nCheck the terminal for details.`);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col w-full overflow-x-hidden relative">

            {/* Fixed Background for Mobile Stability */}
            <div className="fixed inset-0 -z-50 bg-[#0f172a]" style={{
                backgroundImage: `
                        radial-gradient(at 10% 20%, hsla(210, 60%, 85%, 1) 0, transparent 50%),
                        radial-gradient(at 90% 10%, hsla(270, 40%, 88%, 1) 0, transparent 40%),
                        radial-gradient(at 50% 50%, hsla(220, 60%, 92%, 1) 0, transparent 60%),
                        radial-gradient(at 20% 80%, hsla(200, 50%, 85%, 1) 0, transparent 50%),
                        radial-gradient(at 80% 90%, hsla(240, 40%, 88%, 1) 0, transparent 50%)
                    `
            }} />

            <header className="glass-panel sticky top-0 z-50 border-b-0">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <VinylLogo className="w-14 h-14 drop-shadow-lg" />
                        <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase italic">
                            Vinyl <span className="text-slate-600 font-bold">Catalog</span>
                        </h1>
                    </div>

                    <nav className="flex items-center gap-2 md:gap-4">
                        {!IS_STATIC && (
                            <>
                                {user ? (
                                    <>
                                        <button
                                            onClick={handleExport}
                                            disabled={isExporting}
                                            className="hidden md:flex items-center gap-2 bg-surface text-secondary px-4 py-2 rounded-full hover:bg-white/5 hover:text-primary transition-colors font-medium text-sm border border-border"
                                            title="Export to Excel/CSV"
                                        >
                                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                            <span className="hidden sm:inline">Export</span>
                                        </button>
                                        <button
                                            onClick={() => setIsImportOpen(true)}
                                            className="hidden md:flex items-center gap-2 bg-surface text-secondary px-4 py-2 rounded-full hover:bg-white/5 hover:text-primary transition-colors font-medium text-sm border border-border"
                                            title="Import CSV"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <span className="hidden sm:inline">Import</span>
                                        </button>
                                        <button
                                            onClick={onOpenUpload}
                                            className="hidden md:flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors font-medium text-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Vinyls</span>
                                        </button>
                                    </>
                                ) : null}
                                <button
                                    onClick={onOpenDebug}
                                    className="p-2 text-secondary hover:text-red-400 transition-colors hover:bg-white/5 rounded-full"
                                    title="Admin / Login"
                                >
                                    <Bug className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={onOpenSettings}
                                    className="p-2 text-secondary hover:text-primary transition-colors hover:bg-white/5 rounded-full"
                                    title="Settings"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                            </>
                        )}
                    </nav>
                </div>
            </header >

            <main className="flex-1 container mx-auto px-4 py-0 md:py-8">
                {children}
            </main>

            {/* Floating Action Button for Mobile */}
            {
                !IS_STATIC && user && (
                    <button
                        onClick={onOpenUpload}
                        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center"
                        title="Add Vinyls"
                        aria-label="Add Vinyls"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                )
            }

            <ImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onComplete={() => {
                    setIsImportOpen(false);
                    // Force refresh
                    window.location.reload();
                }}
            />

            <footer className="border-t border-border py-6 mt-4">
                <div className="container mx-auto px-4 text-center text-white/40 text-sm">
                    <p>© {new Date().getFullYear()} Vinyl Catalog. Audiophile Grade. <span className="opacity-90 font-bold text-white/60 text-xs">v2.2</span></p>
                </div>
            </footer>
        </div >
    );
}
