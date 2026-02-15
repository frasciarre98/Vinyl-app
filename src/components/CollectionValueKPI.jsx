import React, { useMemo } from 'react';
import { Gem, TrendingUp } from 'lucide-react';

export function CollectionValueKPI({ vinyls }) {
    const totalValue = useMemo(() => {
        if (!vinyls || vinyls.length === 0) return 0;

        return vinyls.reduce((acc, vinyl) => {
            // 1. Convert to string and clean
            let costStr = String(vinyl.average_cost || vinyl.avarege_cost || '');

            // Handle "Varies" or "Unknown" with a reasonable optimistic estimate
            if (costStr.match(/varies|unknown|tbd|check/i)) {
                return acc + 25; // Optimistic average for unpriced items
            }

            // Remove all non-numeric chars except dash and dot
            // This strips € $ EUR USD and spaces around them, leaving "20-30" or "25.50"
            let cleanStr = costStr.replace(/[^0-9.\-]/g, '');

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
                // console.log(`Parsed Single: ${costStr} -> ${val}`);
                return acc + val;
            }

            return acc;
        }, 0);
    }, [vinyls]);

    // Format with Euro symbol and thousand separators
    const formattedValue = new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
    }).format(totalValue);

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

                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-200 whitespace-nowrap">
                        {vinyls.length} items
                    </span>
                </div>
            </div>
        </div>
    );
}
