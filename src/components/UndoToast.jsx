import React from 'react';
import ReactDOM from 'react-dom';
import { RotateCcw } from 'lucide-react';

export function UndoToast({ count, onUndo }) {
    if (count === 0) return null;

    return ReactDOM.createPortal(
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[99999] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-zinc-900 border border-white/20 text-white pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-4 backdrop-blur-xl">
                <span className="font-medium text-sm">
                    Deleted <span className="text-red-400 font-bold">{count}</span> record{count > 1 ? 's' : ''}
                </span>
                <button
                    onClick={onUndo}
                    className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-200 active:scale-95 transition-all flex items-center gap-2"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    UNDO
                </button>
            </div>
        </div>,
        document.body
    );
}
