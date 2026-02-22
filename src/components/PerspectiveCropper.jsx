import React, { useState, useRef, useEffect } from 'react';
import { warpImage } from '../lib/perspective';
import { Check, X, Move } from 'lucide-react';

export function PerspectiveCropper({ imageSrc, onComplete, onCancel }) {
    const [points, setPoints] = useState([]); // [{x,y}, {x,y}, {x,y}, {x,y}] (TL, TR, BR, BL)
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef(null);
    const [draggingIdx, setDraggingIdx] = useState(null);
    const [processing, setProcessing] = useState(false);

    // Initialize points to corners when image loads
    const onImgLoad = (e) => {
        const { width, height } = e.currentTarget.getBoundingClientRect();
        // Use natural dimensions for calculations, but displayed dimensions for UI
        setImgSize({ width, height });

        const p = 20; // padding
        setPoints([
            { x: p, y: p }, // TL
            { x: width - p, y: p }, // TR
            { x: width - p, y: height - p }, // BR
            { x: p, y: height - p } // BL
        ]);
    };

    const handleDragStart = (idx, e) => {
        // Prevent default only if possible (passive listeners issue)
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        setDraggingIdx(idx);
    };

    const handleDragMove = (e) => {
        if (draggingIdx === null || !containerRef.current) return;

        // Handle both mouse and touch events
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;

        if (!clientX || !clientY) return;

        // Calculate relative position
        const rect = containerRef.current.getBoundingClientRect();
        let x = clientX - rect.left;
        let y = clientY - rect.top;

        // Clamp
        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));

        setPoints(prev => {
            const newPoints = [...prev];
            newPoints[draggingIdx] = { x, y };
            return newPoints;
        });
    };

    const handleDragEnd = () => {
        setDraggingIdx(null);
    };

    // Global events
    useEffect(() => {
        if (draggingIdx !== null) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove, { passive: false });
            window.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [draggingIdx]);


    const handleSave = async () => {
        setProcessing(true);
        try {
            // We need to map the UI points (displayed size) back to Natural Image size
            const img = containerRef.current.querySelector('img');
            const scaleX = img.naturalWidth / imgSize.width;
            const scaleY = img.naturalHeight / imgSize.height;

            const naturalPoints = points.map(p => ({
                x: p.x * scaleX,
                y: p.y * scaleY
            }));

            const blob = await warpImage(img, naturalPoints);
            onComplete(blob);
        } catch (e) {
            console.error(e);
            alert("Error warping image: " + e.message);
            setProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full touch-pan-x touch-pan-y bg-black/90">
            {/* Scrollable Viewport */}
            <div className="flex-1 overflow-auto relative p-8 scrollbar-thin">
                {/* Content Wrapper - margin-auto centers it, w-fit ensures it doesn't stretch */}
                <div
                    ref={containerRef}
                    className="relative m-auto w-fit h-fit border-2 border-dashed border-white/20 shadow-2xl"
                >
                    <img
                        src={imageSrc}
                        onLoad={onImgLoad}
                        onError={(e) => {
                            console.error("Perspective Image Load Error", e);
                            alert("Failed to load image for perspective editing. Possible CORS issue or broken URL.");
                        }}
                        crossOrigin="anonymous"
                        className="max-h-[50vh] max-w-[80vw] select-none pointer-events-none block"
                        alt="Perspective Target"
                    />

                    {/* SVG Content for Polygon connection lines */}
                    <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
                        <polygon
                            points={points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="rgba(16, 185, 129, 0.2)"
                            stroke="#10b981"
                            strokeWidth="2"
                        />
                    </svg>

                    {/* Draggable Handles */}
                    {points.map((p, idx) => (
                        <div
                            key={idx}
                            onMouseDown={(e) => handleDragStart(idx, e)}
                            onTouchStart={(e) => handleDragStart(idx, e)}
                            style={{
                                left: p.x,
                                top: p.y,
                                transform: 'translate(-50%, -50%)',
                                touchAction: 'none'
                            }}
                            className={`absolute w-12 h-12 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-move flex items-center justify-center transition-transform z-20 ${draggingIdx === idx ? 'bg-green-400 scale-125 ring-4 ring-white' : 'bg-white hover:scale-110 ring-2 ring-green-500'
                                }`}
                        >
                            <span className="text-xs font-bold text-black select-none pointer-events-none">
                                {['TL', 'TR', 'BR', 'BL'][idx]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-surface border-t border-border flex justify-between items-center">
                <div className="text-sm text-secondary">
                    <p className="font-bold text-white flex items-center gap-2">
                        <Move className="w-4 h-4" /> Adjust Corners
                    </p>
                    Drag the 4 corners to match the vinyl edges.
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        disabled={processing}
                        className="px-4 py-2 text-sm text-secondary hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={processing}
                        className="px-6 py-2 bg-primary text-black font-bold rounded-lg flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
                    >
                        {processing ? 'Processing...' : (
                            <>
                                <Check className="w-4 h-4" /> Apply Fix
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
