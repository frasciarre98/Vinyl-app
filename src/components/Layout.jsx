import React, { useState, useEffect } from 'react';
import { Settings, Plus, Download, Loader2, Bug, Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { VinylLogo } from './VinylLogo';
import { pb } from '../lib/pocketbase';

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true' || import.meta.env.PROD;

export function Layout({ children, onOpenSettings, onOpenUpload, onOpenDebug }) {
    const [isExporting, setIsExporting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
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
            const data = await pb.collection('vinyls').getFullList({
                sort: '-created',
            });

            if (!data || data.length === 0) {
                alert('No vinyls to export!');
                return;
            }

            // CSV Headers (Semicolon for Excel compatibility in IT/EU)
            const headers = ['Title', 'Artist', 'Year', 'Genre', 'Group Members', 'Condition', 'Format', 'Notes', 'Tracks'];

            // Convert data to CSV format
            const csvRows = [
                headers.join(';'), // Header row
                ...data.map(row => {
                    return [
                        `"${(row.title || '').replace(/"/g, '""')}"`,
                        `"${(row.artist || '').replace(/"/g, '""')}"`,
                        `"${(row.year || '').replace(/"/g, '""')}"`,
                        `"${(row.genre || '').replace(/"/g, '""')}"`,
                        `"${(row.group_members || '').replace(/"/g, '""')}"`,
                        `"${(row.condition || '').replace(/"/g, '""')}"`,
                        `"${(row.format || 'Vinyl').replace(/"/g, '""')}"`,
                        `"${(row.notes || '').replace(/"/g, '""')}"`,
                        `"${(row.tracks || '').replace(/"/g, '""').replace(/\n/g, ', ')}"` // Replace newlines with commas for single line
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
            alert('Failed to export database. Check console for details.');
        } finally {
            setIsExporting(false);
        }
    };

    const handlePublish = async () => {
        if (!confirm("🚀 MAGIC PUBLISH\n\nThis will export your current collection (data + images) and push it to GitHub/Vercel.\n\nContinue?")) return;

        setIsPublishing(true);
        try {
            const res = await fetch('/api/publish');
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

                    <nav className="flex items-center gap-4">
                        {!IS_STATIC && (
                            <>
                                <button
                                    onClick={handlePublish}
                                    disabled={isPublishing}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all
                                        ${isPublishing ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-600 text-white hover:bg-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] active:scale-95'}
                                    `}
                                    title="Publish Static Mirror to Vercel"
                                >
                                    {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                                    <span>{isPublishing ? 'Publishing...' : 'Magic Publish'}</span>
                                </button>
                                <button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="flex items-center gap-2 bg-surface text-secondary px-4 py-2 rounded-full hover:bg-white/5 hover:text-primary transition-colors font-medium text-sm border border-border"
                                    title="Export to Excel/CSV"
                                >
                                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                                <button
                                    onClick={onOpenUpload}
                                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors font-medium text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Vinyls</span>
                                </button>
                                <button
                                    onClick={onOpenDebug}
                                    className="p-2 text-secondary hover:text-red-400 transition-colors hover:bg-white/5 rounded-full"
                                    title="Debug / Admin"
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
            </header>

            <main className="flex-1 container mx-auto px-4 py-0 md:py-8">
                {children}
            </main>

            <footer className="border-t border-border py-6 mt-4">
                <div className="container mx-auto px-4 text-center text-white/40 text-sm">
                    <p>© {new Date().getFullYear()} Vinyl Catalog. Audiophile Grade. <span className="opacity-90 font-bold text-white/60 text-xs">v2.2</span></p>
                </div>
            </footer>


        </div>
    );
}
