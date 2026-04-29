import React, { useMemo, useState } from 'react';
import { Gem, TrendingUp, Cloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function CollectionValueKPI({ vinyls }) {
    const totalValue = useMemo(() => {
        if (!vinyls || vinyls.length === 0) return 0;

        try {
            return vinyls.reduce((acc, vinyl) => {
                // 1. Convert to string and clean
                let costStr = String(vinyl.average_cost || vinyl.avarege_cost || '');
                if (!costStr) return acc;

                // Handle "Varies" or "Unknown" with a reasonable optimistic estimate
                if (costStr.match(/varies|unknown|tbd|check/i)) {
                    return acc + 25; // Optimistic average for unpriced items
                }

                // Remove all non-numeric chars except dash and dot
                // This strips € $ EUR USD and spaces around them, leaving "20-30" or "25.50"
                let cleanStr = costStr.replace(/[^0-9.\-]/g, '');
                if (!cleanStr) return acc;

                // Handle range "20-30"
                if (cleanStr.includes('-')) {
                    const parts = cleanStr.split('-').filter(p => p.trim() !== '');
                    if (parts.length >= 2) {
                        const low = parseFloat(parts[0]);
                        const high = parseFloat(parts[1]);
                        if (!isNaN(low) && !isNaN(high)) {
                            const avg = (low + high) / 2;
                            return acc + avg;
                        }
                    }
                }

                // Handle single value
                const val = parseFloat(cleanStr);
                if (!isNaN(val)) {
                    return acc + val;
                }

                return acc;
            }, 0);
        } catch (e) {
            console.error("Error calculating collection value:", e);
            return 0; // Fallback to 0 to prevent UI crash
        }
    }, [vinyls]);

    // Format with Euro symbol and thousand separators
    const formattedValue = new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
    }).format(totalValue);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncStatus('syncing');
        try {
            const res = await fetch('/api/publish');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Sync failed');
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (err) {
            console.error(err);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="relative overflow-hidden mb-4 group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/40 via-emerald-900/20 to-transparent border border-emerald-500/20 rounded-xl" />

            <div className="relative p-3 flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/40 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]">
                        <Gem className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-emerald-100/60 text-[10px] uppercase tracking-wider font-semibold leading-tight">Total Collection Value</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white tracking-tight drop-shadow-sm leading-none">
                                {formattedValue}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all shadow-sm ${
                            syncStatus === 'success' ? 'bg-green-600 border-green-500 text-white' :
                            syncStatus === 'error' ? 'bg-red-600 border-red-500 text-white' :
                            'bg-emerald-800/80 backdrop-blur border-emerald-700/50 text-emerald-100 hover:bg-emerald-700'
                        }`}
                        title="Sync Collection to Cloud (Vercel)"
                    >
                        {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                         syncStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         syncStatus === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                         <Cloud className="w-3.5 h-3.5" />}
                        <span className="text-[10px] font-bold whitespace-nowrap">
                            {syncStatus === 'syncing' ? 'Syncing...' : 
                             syncStatus === 'success' ? 'Synced!' : 
                             syncStatus === 'error' ? 'Error' : 'Sync Cloud'}
                        </span>
                    </button>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur border border-white/10 rounded-full">
                        <TrendingUp className="w-3.5 h-3.5 text-white/60" />
                        <span className="text-xs font-bold text-white whitespace-nowrap">
                            {vinyls.length} items
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
