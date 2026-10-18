import React, { useMemo } from 'react';
import { X, PieChart, BarChart2, TrendingUp, Music } from 'lucide-react';
import {
    PieChart as RechartsPie, Pie,
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Disc, ShoppingCart, Star, Wallet, Calendar, Coins } from 'lucide-react';


export function StatsModal({ isOpen, onClose, vinyls }) {
    if (!isOpen) return null;

    const stats = useMemo(() => {
        if (!vinyls.length) return null;

        let totalRecords = 0;
        let totalValue = 0;
        let wantlistTotalRecords = 0;
        let wantlistTotalValue = 0;
        let totalPurchasePrice = 0;
        const purchaseYearSpending = {};
        const genreCounts = {};
        const genreValues = {};
        const artistCounts = {};
        const decadeCounts = {};
        const allRecordsWithValue = [];


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
            const isWantlist = v.is_wantlist === true || String(v.is_wantlist).toLowerCase() === 'true';

            if (isWantlist) {
                wantlistTotalRecords++;
                wantlistTotalValue += parsedValue;
                return; // Do not include Wantlist items in main collection stats
            }

            totalRecords++;
            totalValue += parsedValue;

            // Purchase Price & Year calculation
            let pPrice = 0;
            if (v.purchase_price) {
                const cleanP = String(v.purchase_price).replace('€', '').replace(/\s+/g, '').replace(',', '.');
                const parsedP = parseFloat(cleanP);
                if (!isNaN(parsedP) && parsedP > 0) {
                    pPrice = parsedP;
                    totalPurchasePrice += pPrice;
                }
            }

            let pYear = null;
            if (v.purchase_year) {
                const yMatch = String(v.purchase_year).match(/\d{4}/);
                if (yMatch) pYear = yMatch[0];
            }

            if (pYear || pPrice > 0) {
                const yearKey = pYear || 'Sconosciuto';
                if (!purchaseYearSpending[yearKey]) {
                    purchaseYearSpending[yearKey] = { total: 0, count: 0 };
                }
                purchaseYearSpending[yearKey].total += pPrice;
                purchaseYearSpending[yearKey].count += 1;
            }

            if (parsedValue > 0) {
                allRecordsWithValue.push({ ...v, parsedValue });
            }

            // Genre
            const genre = (v.genre || 'Unknown').split(',')[0].trim();
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            genreValues[genre] = (genreValues[genre] || 0) + parsedValue;

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

        const genreValueData = Object.entries(genreValues)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10 genres by value

        const barData = Object.entries(artistCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10 artists

        const decadeData = Object.entries(decadeCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const purchaseYearData = Object.entries(purchaseYearSpending)
            .map(([year, info]) => ({
                name: year,
                spesa: Math.round(info.total * 100) / 100,
                dischi: info.count
            }))
            .sort((a, b) => {
                if (a.name === 'Sconosciuto') return 1;
                if (b.name === 'Sconosciuto') return -1;
                return a.name.localeCompare(b.name);
            });

        const activeYears = Object.keys(purchaseYearSpending).filter(y => y !== 'Sconosciuto');
        let totalPurchasedWithYear = 0;
        activeYears.forEach(y => {
            totalPurchasedWithYear += purchaseYearSpending[y].count;
        });

        const avgPurchasePerYear = activeYears.length > 0 ? (totalPurchasePrice / activeYears.length) : 0;
        const avgDischiPerYear = activeYears.length > 0 ? (totalPurchasedWithYear / activeYears.length) : 0;

        const topUntouchables = allRecordsWithValue
            .sort((a, b) => b.parsedValue - a.parsedValue)
            .slice(0, 5);

        return { 
            totalRecords, totalValue, 
            wantlistTotalRecords, wantlistTotalValue, 
            totalPurchasePrice, avgPurchasePerYear, avgDischiPerYear, totalPurchasedWithYear, purchaseYearData,
            pieData, genreValueData, barData, decadeData, 
            topUntouchables 
        };
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <span className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Music className="w-4 h-4 text-primary" /> Collezione
                        </span>
                        <span className="text-3xl font-black text-white">{stats?.totalRecords || 0}</span>
                        <span className="text-[11px] text-white/40 mt-1">vinili totali</span>
                    </div>

                    <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <span className="text-emerald-400/70 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-400" /> Valore Stimato
                        </span>
                        <span className="text-2xl lg:text-3xl font-black text-emerald-400">€ {Math.round(stats?.totalValue || 0).toLocaleString()}</span>
                        <span className="text-[11px] text-emerald-400/50 mt-1">valore di mercato</span>
                    </div>

                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <span className="text-amber-400/70 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Wallet className="w-4 h-4 text-amber-400" /> Spesa Totale
                        </span>
                        <span className="text-2xl lg:text-3xl font-black text-amber-400">€ {Math.round(stats?.totalPurchasePrice || 0).toLocaleString()}</span>
                        <span className="text-[11px] text-amber-400/50 mt-1">costo acquisti</span>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <span className="text-blue-400/70 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-blue-400" /> Spesa / Anno
                        </span>
                        <span className="text-2xl lg:text-3xl font-black text-blue-400">€ {Math.round(stats?.avgPurchasePerYear || 0).toLocaleString()}</span>
                        <span className="text-[11px] text-blue-400/50 mt-1">media spesa annua</span>
                    </div>

                    <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <span className="text-cyan-400/70 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Disc className="w-4 h-4 text-cyan-400" /> Dischi / Anno
                        </span>
                        <span className="text-2xl lg:text-3xl font-black text-cyan-400">
                            {stats?.avgDischiPerYear ? stats.avgDischiPerYear.toFixed(1) : 0}
                        </span>
                        <span className="text-[11px] text-cyan-400/50 mt-1">media acquisti annui</span>
                    </div>

                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <span className="text-purple-400/70 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShoppingCart className="w-4 h-4 text-purple-400" /> Desideri
                        </span>
                        <span className="text-3xl font-black text-purple-400">{stats?.wantlistTotalRecords || 0}</span>
                        <span className="text-[11px] text-purple-400/50 mt-1">€ {Math.round(stats?.wantlistTotalValue || 0).toLocaleString()} stimati</span>
                    </div>
                </div>

                {/* Top 5 Untouchables */}
                {stats?.topUntouchables?.length > 0 && (
                    <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-600/10 border border-yellow-500/30 rounded-2xl p-6">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-yellow-500">
                            <Star className="w-6 h-6 fill-yellow-500" /> The Untouchables (Top 5 Value)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {stats.topUntouchables.map((v, i) => (
                                <div key={v.id} className="bg-black/40 rounded-xl overflow-hidden border border-yellow-500/20 relative group">
                                    <div className="absolute top-2 left-2 w-6 h-6 bg-yellow-500 text-black font-black text-xs rounded-full flex items-center justify-center z-10 shadow-lg">
                                        {i + 1}
                                    </div>
                                    <div className="aspect-square relative overflow-hidden">
                                        {v.image_url ? (
                                            <img src={v.image_url} alt={v.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                                <Disc className="w-8 h-8 text-white/20" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                            <div className="text-yellow-400 font-black text-lg mb-0.5">€ {v.parsedValue}</div>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h4 className="font-bold text-white text-sm truncate">{v.title}</h4>
                                        <p className="text-xs text-gray-400 truncate">{v.artist}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Purchase Spending & Volume by Year Chart */}
                    {stats?.purchaseYearData?.length > 0 && (
                        <div className="bg-gradient-to-br from-amber-950/30 to-slate-900 border border-amber-500/20 rounded-2xl p-6 lg:col-span-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-amber-400">
                                        <Wallet className="w-5 h-5 text-amber-400" /> Spesa e Dischi Acquistati per Anno
                                    </h3>
                                    <p className="text-xs text-white/50 mt-1">Confronto tra spesa economica (€) e volume di acquisti (dischi)</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                                        <span className="text-amber-400 font-bold">Spesa (€)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                                        <span className="text-sky-400 font-bold">Dischi (N°)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats?.purchaseYearData || []} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                        <XAxis dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 12 }} />
                                        <YAxis yAxisId="spesa" tick={{ fill: '#f59e0b', fontSize: 11 }} tickFormatter={(val) => `€${val}`} />
                                        <YAxis yAxisId="dischi" orientation="right" tick={{ fill: '#38bdf8', fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip 
                                            formatter={(value, name) => [name === 'spesa' ? `€ ${value}` : `${value} dischi`, name === 'spesa' ? 'Spesa Totale' : 'Dischi Acquistati']}
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff' }} 
                                        />
                                        <Bar yAxisId="spesa" dataKey="spesa" name="spesa" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        <Bar yAxisId="dischi" dataKey="dischi" name="dischi" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Year breakdown badges */}
                            <div className="flex flex-wrap gap-2.5 justify-center mt-6 pt-4 border-t border-white/10">
                                {stats?.purchaseYearData?.map((item) => (
                                    <div key={item.name} className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl text-xs">
                                        <span className="font-bold text-white">{item.name}:</span>
                                        <span className="text-amber-400 font-bold">€ {item.spesa.toLocaleString()}</span>
                                        <span className="text-white/30">•</span>
                                        <span className="text-sky-400 font-bold">{item.dischi} {item.dischi === 1 ? 'disco' : 'dischi'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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

                    {/* Value by Genre Chart */}
                    <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-6">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-emerald-400">
                            <TrendingUp className="w-5 h-5" /> Value by Genre (€)
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.genreValueData || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#e2e8f0', fontSize: 12 }} />
                                    <Tooltip formatter={(value) => [`€ ${value}`, 'Value']} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
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
