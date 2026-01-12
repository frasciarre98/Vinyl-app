import React, { useEffect } from 'react';
import { X, Edit2, Trash2, Calendar, Disc, Music2, AlertCircle, CheckCircle, ListMusic, DollarSign, PlayCircle, Youtube } from 'lucide-react';

const icons = { PlayCircle, Youtube }; // Quick fix for previous replacement using icons.Namespace

export function VinylDetailModal({ vinyl, isOpen, onClose, onEdit, onDelete }) {
    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen || !vinyl) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-3xl animate-in slide-in-from-bottom duration-300">
            {/* Header / Actions */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50 sticky top-0 z-10 shrink-0">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 text-white/70 hover:text-white rounded-full active:bg-white/10 transition-colors"
                >
                    <X className="w-8 h-8" />
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={() => onEdit(vinyl)}
                        className="p-2 text-blue-400 hover:text-blue-300 bg-blue-500/10 rounded-full"
                    >
                        <Edit2 className="w-6 h-6" />
                    </button>
                    {/* External Links */}
                    <a
                        href={`https://open.spotify.com/search/${encodeURIComponent((vinyl.artist || '') + ' ' + (vinyl.title || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#1DB954] hover:text-[#1ed760] bg-[#1DB954]/10 rounded-full"
                    >
                        <icons.PlayCircle className="w-6 h-6" />
                    </a>
                    <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent((vinyl.artist || '') + ' ' + (vinyl.title || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 rounded-full"
                    >
                        <icons.Youtube className="w-6 h-6" />
                    </a>
                    <button
                        onClick={() => onDelete(vinyl.id)}
                        className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 rounded-full"
                    >
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col min-h-full pb-20">

                    {/* Large Cover Art with Gradient */}
                    <div className="relative w-full aspect-square max-h-[50vh] bg-black shrink-0">
                        {vinyl.image_url ? (
                            <img
                                src={vinyl.image_url}
                                alt={vinyl.title}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10">
                                <Disc className="w-32 h-32" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    </div>

                    {/* Metadata Container */}
                    <div className="px-6 -mt-12 relative z-10 space-y-8">

                        {/* Title & Artist */}
                        <div className="space-y-2">
                            <h1 className="text-3xl font-black text-white leading-tight dropshadow-xl">
                                {vinyl.title || 'Unknown Album'}
                            </h1>
                            <p className="text-xl text-primary font-medium">
                                {vinyl.artist || 'Unknown Artist'}
                            </p>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-gray-300">
                                <Calendar className="w-4 h-4 text-secondary" />
                                {vinyl.year || 'N/A'}
                            </div>
                            <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-gray-300">
                                <Music2 className="w-4 h-4 text-secondary" />
                                {vinyl.genre || 'N/A'}
                            </div>
                            <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-gray-300">
                                <Disc className="w-4 h-4 text-secondary" />
                                {vinyl.format || 'Vinyl'}
                            </div>
                            {(vinyl.avarege_cost || vinyl.average_cost) && (
                                <div className="bg-green-900/20 px-4 py-2 rounded-full border border-green-500/20 flex items-center gap-2 text-green-400">
                                    <DollarSign className="w-4 h-4" />
                                    {vinyl.avarege_cost || vinyl.average_cost}
                                </div>
                            )}
                        </div>

                        {/* Tracks */}
                        <div className="space-y-4">
                            <h3 className="text-sm uppercase tracking-widest text-secondary font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                                <ListMusic className="w-4 h-4" /> Tracklist
                            </h3>
                            <div className="space-y-3 pl-2">
                                {vinyl.tracks ? (
                                    vinyl.tracks.split('\n').map((track, i) => (
                                        <div key={i} className="flex gap-4 text-gray-300 text-base py-1 border-b border-white/5 last:border-0">
                                            <span className="text-white/20 font-mono w-6 text-right shrink-0">{i + 1}</span>
                                            <span className="font-light">{track}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-white/30 italic px-4">No tracks listed</p>
                                )}
                            </div>
                        </div>

                        {/* Additional Data Grid */}
                        <div className="grid grid-cols-1 gap-6 pt-4">
                            <div>
                                <h4 className="text-xs uppercase text-secondary mb-2">Group Members</h4>
                                <p className="text-gray-400 font-light leading-relaxed">
                                    {vinyl.group_members || '—'}
                                </p>
                            </div>
                            <div>
                                <h4 className="text-xs uppercase text-secondary mb-2">Notes</h4>
                                <p className="text-gray-400 font-light italic leading-relaxed border-l-2 border-white/10 pl-4">
                                    {vinyl.notes || '—'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 pt-2 text-xs text-white/30">
                                <AlertCircle className="w-3 h-3" />
                                <span className="uppercase">Condition:</span>
                                <span className="text-white">{vinyl.condition || 'N/A'}</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
