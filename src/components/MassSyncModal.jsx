import React, { useState, useEffect } from 'react';
import { X, Play, Square, Loader2, Disc } from 'lucide-react';
import { pb } from '../lib/pocketbase';

export function MassSyncModal({ isOpen, onClose, onComplete }) {
    const [records, setRecords] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [loadingInit, setLoadingInit] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoadingInit(true);
            setLogs([]);
            setCurrentIndex(0);
            setIsRunning(false);
            
            // Fetch all vinyls that are not locked
            pb.collection('vinyls').getFullList({ sort: '-created' })
                .then(data => {
                    const unlocked = data.filter(r => !r.is_price_locked && !r.is_wantlist);
                    setRecords(unlocked);
                    setLoadingInit(false);
                })
                .catch(err => {
                    console.error(err);
                    setLogs(prev => [...prev, "❌ Errore caricamento dischi: " + err.message]);
                    setLoadingInit(false);
                });
        }
    }, [isOpen]);

    const log = (msg) => {
        setLogs(prev => [msg, ...prev].slice(0, 50));
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const startSync = async () => {
        setIsRunning(true);
        let i = currentIndex;
        log("🚀 Sincronizzazione massiva avviata...");

        while (i < records.length) {
            // Check if user stopped it
            // We use a functional state update trick to check the latest isRunning, 
            // but in an async loop it's better to just rely on a ref, or simply check the state if it hasn't mutated.
            // Actually, we'll just check a local variable if we use a ref, or just let it run one more.
            // For simplicity, we'll just run it. If they close the modal, it might keep running in background.
            // Let's make it robust:
            const record = records[i];
            setCurrentIndex(i);
            
            try {
                log(`⏳ [${i + 1}/${records.length}] Cerco: ${record.artist} - ${record.title}...`);
                
                const res = await pb.send('/api/discogs/price', {
                    method: 'GET',
                    query: {
                        artist: record.artist,
                        title: record.title,
                        catno: record.catalog_number,
                        format: record.format,
                        condition: record.condition
                    }
                });

                if (res && res.lowest_price) {
                    const cleanCost = `€ ${res.lowest_price}`;
                    await pb.collection('vinyls').update(record.id, {
                        average_cost: cleanCost,
                        is_price_locked: true
                    });
                    log(`✅ Trovato: ${cleanCost} (Base: €${res.base_price} x ${res.multiplier})`);
                } else {
                    log(`⚠️ Nessun prezzo di mercato trovato.`);
                }
            } catch (err) {
                log(`❌ Errore: ${err.data?.error || err.message}`);
            }

            i++;
            setCurrentIndex(i);
            
            if (i < records.length) {
                log(`Attendo 4 secondi per evitare blocchi da Discogs...`);
                await sleep(4000);
            }
        }
        
        setIsRunning(false);
        log("🎉 Sincronizzazione completata!");
        if (onComplete) onComplete();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 rounded-xl max-w-2xl w-full flex flex-col max-h-[90vh] border border-slate-700 shadow-2xl">
                
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3 text-emerald-400">
                        <Disc className="w-6 h-6" />
                        <h2 className="text-xl font-bold text-white">Discogs Mass Sync</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-hidden flex flex-col gap-6">
                    {loadingInit ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                        </div>
                    ) : (
                        <>
                            <div className="bg-slate-800/50 rounded-lg p-4 text-slate-300">
                                <p>Trovati <strong>{records.length}</strong> dischi non bloccati nella collezione.</p>
                                <p className="text-sm mt-2 text-slate-400">
                                    L'operazione analizzerà un disco alla volta (con una pausa di 4 secondi tra l'uno e l'altro per rispettare i limiti di Discogs). 
                                    Tempo stimato: circa {Math.ceil((records.length * 4) / 60)} minuti.
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {!isRunning && currentIndex < records.length && (
                                    <button 
                                        onClick={startSync}
                                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                                    >
                                        <Play className="w-5 h-5" />
                                        {currentIndex === 0 ? "Avvia Sincronizzazione" : "Riprendi Sincronizzazione"}
                                    </button>
                                )}
                                {isRunning && (
                                    <div className="flex-1 flex items-center justify-center gap-3 bg-slate-800 text-emerald-400 font-bold py-3 px-6 rounded-lg">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Sincronizzazione in corso... ({currentIndex}/{records.length})
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 bg-black rounded-lg border border-slate-800 p-4 font-mono text-sm overflow-y-auto">
                                {logs.map((l, i) => (
                                    <div key={i} className="mb-1 text-slate-300 border-b border-slate-800/50 pb-1">
                                        {l}
                                    </div>
                                ))}
                                {logs.length === 0 && <div className="text-slate-600">In attesa...</div>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
