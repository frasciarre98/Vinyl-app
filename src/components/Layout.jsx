import React, { useState } from 'react';
import { Settings, Plus, Download, Loader2, Bug } from 'lucide-react';
import { VinylLogo } from './VinylLogo';
import { databases, DATABASE_ID, isAppwriteConfigured } from '../lib/appwrite';
import { Query } from 'appwrite';

export function Layout({ children, onOpenSettings, onOpenUpload, onOpenDebug }) {
    const isConfigured = isAppwriteConfigured();
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Appwrite: listDocuments (Note: Limit is default 25, need to increase or paginate for full export)
            // For now, fetching up to 5000 (Appwrite max limit per request)
            const { documents: data } = await databases.listDocuments(
                DATABASE_ID,
                'vinyls',
                [Query.limit(5000), Query.orderDesc('$createdAt')]
            );

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

    return (
        <div className="min-h-[100dvh] flex flex-col w-full overflow-x-hidden relative">
            {!isConfigured && (
                <div className="bg-red-600 text-white text-center py-2 px-4 font-bold animate-pulse">
                    ⚠️ Errore Configurazione: PROJECT_ID mancante in src/lib/appwrite.js
                </div>
            )}

            {/* Fixed Background for Mobile Stability */}
            <div className="fixed inset-0 h-[100dvh] -z-50 bg-[#cbd5e1]" style={{
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
                            onClick={onOpenSettings}
                            className="p-2 text-secondary hover:text-primary transition-colors hover:bg-white/5 rounded-full"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </nav>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-1 md:py-8">
                {children}
            </main>

            <footer className="border-t border-border py-6 mt-4">
                <div className="container mx-auto px-4 text-center text-secondary text-sm">
                    <p>© {new Date().getFullYear()} Vinyl Catalog. Audiophile Grade.</p>
                </div>
            </footer>


        </div>
    );
}
