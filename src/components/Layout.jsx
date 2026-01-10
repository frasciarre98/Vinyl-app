import React, { useState } from 'react';
import { Disc, Settings, Plus, Download, Loader2 } from 'lucide-react';
// import { supabase } from '../lib/supabase'; // Removed

export function Layout({ children, onOpenSettings, onOpenUpload }) {
    const isConfigured = !import.meta.env.VITE_SUPABASE_URL?.includes('placeholder') && import.meta.env.VITE_SUPABASE_URL;
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const { data, error } = await supabase.from('vinyls').select('*').order('created_at', { ascending: false });
            if (error) throw error;

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
        <div className="min-h-screen flex flex-col">
            {!isConfigured && (
                <div className="bg-red-600 text-white text-center py-2 px-4 font-bold animate-pulse">
                    ⚠️ ATTENZIONE: Riavvia il server (CTRL+C poi 'npm run dev') per caricare le chiavi dal file .env!
                </div>
            )}
            <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <Disc className="w-6 h-6 text-primary animate-spin-slow" style={{ animationDuration: '10s' }} />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-primary">Vinyl<span className="text-secondary font-light">Catalog</span></h1>
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

            <main className="flex-1 container mx-auto px-4 py-8">
                {children}
            </main>

            <footer className="border-t border-border py-6 mt-12">
                <div className="container mx-auto px-4 text-center text-secondary text-sm">
                    <p>© {new Date().getFullYear()} Vinyl Catalog. Audiophile Grade.</p>
                </div>
            </footer>
        </div>
    );
}
