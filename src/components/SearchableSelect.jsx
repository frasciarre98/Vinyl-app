import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className = "",
    icon: Icon = null
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Initialize search term when value changes externally
    useEffect(() => {
        if (value && !isOpen) {
            // Find the option purely for display debugging if needed, 
            // but usually we just show the value or the selected option label
            // For now assuming options are strings.
            // If complex objects, this needs adjustment.
        }
    }, [value, isOpen]);

    // Filter options
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(opt =>
            opt.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    // Handle outside click to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
        setSearchTerm(''); // Reset search on select? Or keep it? Usually reset.
    };

    const clearSelection = (e) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div
                className="relative cursor-pointer"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) {
                        setTimeout(() => inputRef.current?.focus(), 50);
                    }
                }}
            >
                <div className={`
                    bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-10 
                    text-sm text-left truncate flex items-center gap-2
                    hover:bg-white/10 transition-colors
                    ${value ? 'text-primary font-medium' : 'text-secondary'}
                `}>
                    {Icon && <Icon className="w-4 h-4 opacity-50" />}
                    {value || placeholder}
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {value && (
                        <button
                            onClick={clearSelection}
                            className="p-1 hover:bg-white/20 rounded-full text-white/50 hover:text-white transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
                    {/* Search Input */}
                    <div className="p-2 border-b border-white/5 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border-none rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-primary/50"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* Options List */}
                    <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 p-1">
                        <div
                            className={`
                                px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors
                                ${value === "" ? 'bg-primary/20 text-primary' : 'text-secondary hover:bg-white/5 hover:text-white'}
                            `}
                            onClick={() => handleSelect('')}
                        >
                            All Artists
                        </div>

                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, i) => (
                                <div
                                    key={i}
                                    className={`
                                        px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors truncate
                                        ${value === opt ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/5 hover:text-white'}
                                    `}
                                    onClick={() => handleSelect(opt)}
                                >
                                    {opt}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-white/30">
                                No artists found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
