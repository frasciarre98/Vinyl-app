import React from 'react';

export function VinylLogo({ className = "w-10 h-10", spin = true }) {
    return (
        <svg
            viewBox="0 0 100 100"
            className={`${className} ${spin ? 'animate-spin' : ''}`}
            style={{ animationDuration: '6s' }}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Drop Shadow */}
            <circle cx="50" cy="50" r="48" fill="rgba(0,0,0,0.2)" filter="blur(2px)" />

            {/* Vinyl Body - Dark Slate/Black Gradient */}
            <defs>
                <linearGradient id="vinylShine" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="50%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#334155" />
                </linearGradient>
                <linearGradient id="labelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#be123c" />
                </linearGradient>
            </defs>

            {/* Main Disc */}
            <circle cx="50" cy="50" r="45" fill="url(#vinylShine)" stroke="#0f172a" strokeWidth="1" />

            {/* Grooves */}
            <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.5" />
            <circle cx="50" cy="50" r="35" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.5" />
            <circle cx="50" cy="50" r="30" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.5" />
            <circle cx="50" cy="50" r="25" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.5" />

            {/* Label */}
            <circle cx="50" cy="50" r="18" fill="url(#labelGradient)" />

            {/* Label Asymmetrical Details (Text lines) */}
            <rect x="38" y="42" width="24" height="2" fill="white" fillOpacity="0.8" rx="1" />
            <rect x="42" y="46" width="16" height="2" fill="white" fillOpacity="0.6" rx="1" />
            <circle cx="50" cy="58" r="1.5" fill="white" fillOpacity="0.8" />

            {/* Spindle Hole */}
            <circle cx="50" cy="50" r="2" fill="#f1f5f9" />

            {/* Distributed Specular Highlights (Multi-faceted) */}
            {/* Top-Right Large Wedge */}
            <path d="M 50 50 L 50 5 A 45 45 0 0 1 85 20 Z" fill="white" fillOpacity="0.12" />

            {/* Bottom-Right Medium Wedge */}
            <path d="M 50 50 L 92 65 A 45 45 0 0 1 75 88 Z" fill="white" fillOpacity="0.08" />

            {/* Bottom-Left Bright Wedge */}
            <path d="M 50 50 L 35 93 A 45 45 0 0 1 15 75 Z" fill="white" fillOpacity="0.15" />

            {/* Top-Left Thin Streak */}
            <path d="M 50 50 L 10 40 A 45 45 0 0 1 15 25 Z" fill="white" fillOpacity="0.1" />
        </svg>
    );
}
