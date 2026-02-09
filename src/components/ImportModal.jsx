import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { pb } from '../lib/pocketbase';

export function ImportModal({ isOpen, onClose, onComplete }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [importing, setImporting] = useState(false);
    const [stats, setStats] = useState(null);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            const lines = content.split('\n');
            if (lines.length < 2) return;

            // Detect separator (semicolon or comma)
            const header = lines[0];
            const separator = header.includes(';') ? ';' : ',';

            const headers = header.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
            const data = lines.slice(1, 6).map(line => {
                const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
                return headers.reduce((obj, h, i) => {
                    obj[h] = values[i];
                    return obj;
                }, {});
            });
            setPreview(data);
        };
        reader.readAsText(selectedFile);
    };

    const processImport = async () => {
        if (!file) return;
        setImporting(true);
        setStats(null);

        try {
            const content = await file.text();
            const lines = content.split('\n');
            const headerLine = lines[0];
            const separator = headerLine.includes(';') ? ';' : ',';
            const headers = headerLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));

            const rows = lines.slice(1).filter(line => line.trim() !== '');
            let updated = 0;
            let added = 0;
            let skipped = 0;

            const existingRecords = await pb.collection('vinyls').getFullList();

            for (const line of rows) {
                const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
                const rowData = headers.reduce((obj, h, i) => {
                    obj[h] = values[i];
                    return obj;
                }, {});

                // Clean keys to match PB schema - full mapping for 20 fields
                const record = {
                    title: rowData.Title || rowData.title,
                    artist: rowData.Artist || rowData.artist,
                    year: rowData.Year || rowData.year,
                    genre: rowData.Genre || rowData.genre,
                    group_members: rowData['Group Members'] || rowData.group_members || '',
                    condition: rowData.Condition || rowData.condition,
                    format: rowData.Format || rowData.format || 'Vinyl',
                    rating: parseInt(rowData.Rating || rowData.rating || '0'),
                    label: rowData.Label || rowData.label || '',
                    catalog_number: rowData['Catalog No.'] || rowData.catalog_number || '',
                    edition: rowData['Edition / Variant'] || rowData.edition || '',
                    avarege_cost: rowData['Average Cost'] || rowData.average_cost || rowData.avarege_cost || '',
                    purchase_price: rowData['Purchase Price'] || rowData.purchase_price || '',
                    purchase_year: rowData['Purchase Year'] || rowData.purchase_year || '',
                    is_price_locked: (rowData['Price Locked'] || '').toLowerCase() === 'yes',
                    is_tracks_validated: (rowData['Tracks Validated'] || '').toLowerCase() === 'yes',
                    locked_fields: (rowData['Locked Fields'] || '').split(',').map(f => f.trim()).filter(f => f),
                    notes: rowData.Notes || rowData.notes || '',
                    tracks: (rowData.Tracks || rowData.tracks || '').replace(/, /g, '\n'),
                };

                // Find match
                let match = null;
                const rowId = rowData.ID || rowData.id;
                if (rowId && rowId.length > 0) {
                    match = existingRecords.find(r => r.id === rowId);
                } else {
                    match = existingRecords.find(r =>
                        r.artist.toLowerCase() === (record.artist || '').toLowerCase() &&
                        r.title.toLowerCase() === (record.title || '').toLowerCase()
                    );
                }

                if (match) {
                    await pb.collection('vinyls').update(match.id, record);
                    updated++;
                } else if (record.title && record.artist) {
                    await pb.collection('vinyls').create(record);
                    added++;
                } else {
                    skipped++;
                }
            }
            setStats({ updated, added, skipped });
            if (onComplete) onComplete();
        } catch (error) {
            console.error("Import error:", error);
            alert("Errore durante l'importazione: " + error.message);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="glass-heavy rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" /> Bulk CSV Import
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!stats ? (
                        <>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                                    ${file ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
                                `}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".csv"
                                    className="hidden"
                                />
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <FileText className="w-12 h-12 text-primary" />
                                        <p className="font-medium text-white">{file.name}</p>
                                        <p className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className="w-12 h-12 text-white/20" />
                                        <p className="font-medium text-white/70">Click to upload CSV</p>
                                        <p className="text-xs text-white/30">Supports Comma (,) or Semicolon (;) separators</p>
                                    </div>
                                )}
                            </div>

                            {preview.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Data Preview (5 rows)</h3>
                                    <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="bg-white/5 text-white/60">
                                                    <th className="px-3 py-2">Artist</th>
                                                    <th className="px-3 py-2">Title</th>
                                                    <th className="px-3 py-2">Format</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {preview.map((row, i) => (
                                                    <tr key={i} className="text-white/80">
                                                        <td className="px-3 py-2 truncate max-w-[150px]">{row.Artist || row.artist}</td>
                                                        <td className="px-3 py-2 truncate max-w-[150px]">{row.Title || row.title}</td>
                                                        <td className="px-3 py-2">{row.Format || row.format}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button onClick={onClose} className="px-6 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">Cancel</button>
                                <button
                                    disabled={!file || importing}
                                    onClick={processImport}
                                    className="px-6 py-2 bg-primary text-black rounded-lg font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    {importing ? 'Importing...' : 'Start Import'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center space-y-6 animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-500/5">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold">Import Completed!</h3>
                                <p className="text-white/40 text-sm">Your library has been successfully updated.</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-2xl font-black text-primary">{stats.added}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-white/30 font-bold">New</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-2xl font-black text-blue-400">{stats.updated}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Updated</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="text-2xl font-black text-white/20">{stats.skipped}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Skipped</div>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-colors"
                            >
                                Close & Refresh
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
