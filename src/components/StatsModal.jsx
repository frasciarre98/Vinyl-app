import React, { useMemo } from 'react';
import { X, PieChart, BarChart2, TrendingUp, Music } from 'lucide-react';
import {
    PieChart as RechartsPie, Pie,
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

export function StatsModal({ isOpen, onClose, vinyls }) {
    if (!isOpen) return null;

    const stats = useMemo(() => {
        if (!vinyls.length) return null;

        let totalRecords = vinyls.length;
        let totalValue = 0;
        const genreCounts = {};
        const artistCounts = {};
        const decadeCounts = {};

        vinyls.forEach(v => {
            // Value - UNIFIED LOGIC with CollectionValueKPI
            let costStr = String(v.average_cost || v.avarege_cost || '');
            let parsedValue = 0;

            if (costStr.match(/varies|unknown|tbd|check/i)) {
                parsedValue = 25; // Optimistic fallback
            } else {
                let cleanStr = costStr.replace(/[^0-9.\-]/g, '');
                if (cleanStr.includes('-')) {
                    const parts = cleanStr.split('-').filter(p => p.trim() !== '');
                    if (parts.length >= 2) {
                        const low = parseFloat(parts[0]);
                        const high = parseFloat(parts[1]);
                        if (!isNaN(low) && !isNaN(high)) parsedValue = (low + high) / 2;
                    }
                } else {
                    const val = parseFloat(cleanStr);
                    if (!isNaN(val)) parsedValue = val;
                }
            }
            totalValue += parsedValue;

            // Genre
            const genre = (v.genre || 'Unknown').split(',')[0].trim();
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;

            // Artist
            const artist = v.artist || 'Unknown Artist';
            artistCounts[artist] = (artistCounts[artist] || 0) + 1;

            // Decade
            if (v.year) {
                const yearMatch = String(v.year).match(/\d{4}/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[0]);
                    const decade = Math.floor(year / 10) * 10;
                    decadeCounts[`${decade}s`] = (decadeCounts[`${decade}s`] || 0) + 1;
                } else {
                    decadeCounts['Unknown'] = (decadeCounts['Unknown'] || 0) + 1;
                }
            } else {
                decadeCounts['Unknown'] = (decadeCounts['Unknown'] || 0) + 1;
            }
        });

        // Format for Recharts
        const pieData = Object.entries(genreCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10 genres

        const barData = Object.entries(artistCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10 artists

        const decadeData = Object.entries(decadeCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return { totalRecords, totalValue, pieData, barData, decadeData };
    }, [vinyls]);

    const COLORS = ['#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <BarChart2 className="text-primary w-6 h-6" /> Collection Statistics
                </h2>
                <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 hover:text-red-400 text-white transition-all">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-32">

                {/* Top KPIs */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center">
                        <span className="text-white/50 text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Music className="w-4 h-4" /> Total Items
                        </span>
                        <span className="text-4xl font-black text-white">{stats?.totalRecords || 0}</span>
                    </div>
                    <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center justify-center">
                        <span className="text-emerald-400/70 text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Est. Value
                        </span>
                        <span className="text-4xl font-black text-emerald-400">€ {Math.round(stats?.totalValue || 0).toLocaleString()}</span>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Genre Pie Chart */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                            <PieChart className="w-5 h-5 text-purple-400" /> Genre Distribution
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPie>
                                    <Pie data={stats?.pieData || []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                        {(stats?.pieData || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                </RechartsPie>
                            </ResponsiveContainer>
                        </div>
                        {/* Custom Legend */}
                        <div className="flex flex-wrap gap-3 justify-center mt-4 pt-4 border-t border-white/10">
                            {(stats?.pieData || []).map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-2 text-sm bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="text-white font-medium">{entry.name} <span className="text-white/50">({entry.value})</span></span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Artist Bar Chart */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-blue-400" /> Top Artists
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.barData || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#e2e8f0', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Decade Distribution */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:col-span-2">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-400" /> Releases by Decade
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.decadeData || []}>
                                    <XAxis dataKey="name" tick={{ fill: '#e2e8f0' }} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
