import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Wand2, Play, Pause, X, Loader2, AlertTriangle, Terminal } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { analyzeImageUrl, getApiKey, getProvider, getGeminiTier } from '../lib/openai';

export const BatchAnalysisBanner = React.memo(function BatchAnalysisBanner({ vinyls, onUpdate, onComplete }) {
    const pendingItems = useMemo(() =>
        vinyls.filter(v => v.artist === 'Pending AI' || v.artist === 'Error'),
        [vinyls]
    );

    const incompleteItems = useMemo(() =>
        vinyls.filter(v =>
            v.artist !== 'Pending AI' &&
            v.artist !== 'Error' &&
            // User Request: Label and Edition are no longer considered critical errors
            // Check both field names (typo and correct)
            (!v.average_cost && !v.avarege_cost)
        ),
        [vinyls]
    );
    const [isExpanded, setIsExpanded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(0);
    const lastActivityRef = useRef(Date.now());
    const failedIdsRef = useRef(new Set());
    const shouldStopRef = useRef(false);
    const logsEndRef = useRef(null);
    const forcedSafeModeRef = useRef(false);
    const shouldSkipRef = useRef(false);
    const [isRetrying, setIsRetrying] = useState(false);

    // Update activity on every log (CAPPED at 50 to prevent crash)
    const addLog = (msg, type = 'info') => {
        lastActivityRef.current = Date.now();
        const time = new Date().toLocaleTimeString();
        setLogs(prev => {
            const newLogs = [...prev, { time, msg, type }];
            if (newLogs.length > 50) return newLogs.slice(-50);
            return newLogs;
        });
    };

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const startBatch = async (items = null, quiet = false) => {
        // Filter out already failed items to prevent infinite loops (unless forced manually by user click)
        const candidates = items || pendingItems;
        const itemsToProcess = quiet
            ? candidates.filter(item => !failedIdsRef.current.has(item.id))
            : candidates; // Manual start (not quiet) retries everything

        if (itemsToProcess.length === 0) {
            if (!quiet) addLog("No new items to process (some may have failed previously).", "warning");
            setIsProcessing(false);
            return;
        }

        if (!quiet) setIsExpanded(true);
        setIsProcessing(true);
        shouldStopRef.current = false;

        // Reset failed IDs if manual start
        if (!quiet) failedIdsRef.current.clear();

        const apiKey = getApiKey();
        if (!apiKey) {
            addLog("ERROR: API Key not found. Please add it in Settings.", "error");
            setIsProcessing(false);
            return;
        }

        addLog(`Starting sequential analysis for ${itemsToProcess.length} items...`, "success");

        let consecutiveRetries = 0;

        for (let i = 0; i < itemsToProcess.length; i++) {
            // Safety breathe to prevent UI freeze
            await new Promise(r => setTimeout(r, 500));

            if (shouldStopRef.current) {
                addLog("Batch analysis stopped by user.", "warning");
                break;
            }

            const item = itemsToProcess[i];
            const percent = Math.round(((i) / itemsToProcess.length) * 100);
            setProgress(percent);

            addLog(`Analyzing[${i + 1}/${itemsToProcess.length}]: ${item.title || 'Untitled'}...`);

            try {
                // Strict 120s Timeout Race
                const analyzePromise = analyzeImageUrl(item.image_url, apiKey);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 120s")), 120000));

                // Allow UI to breathe before heavy async
                await new Promise(r => setTimeout(r, 0));

                const analysis = await Promise.race([analyzePromise, timeoutPromise]);

                // Update DB (Adaptive)
                const fullUpdate = {
                    artist: analysis.artist,
                    title: analysis.title,
                    genre: analysis.genre,
                    year: analysis.year,
                    notes: analysis.notes,
                    group_members: analysis.group_members,
                    condition: analysis.condition,
                    // Sanitise cost to strict String(50)
                    avarege_cost: String(analysis.average_cost || '').substring(0, 50), // DB Typo in PocketBase Schema
                    tracks: analysis.tracks,
                    label: String(analysis.label || '').substring(0, 100),
                    catalog_number: String(analysis.catalog_number || '').substring(0, 50),
                    edition: String(analysis.edition || '').substring(0, 100)
                };

                // CRITICAL: Respect locked_fields array (Field Protection System)
                const lockedFields = Array.isArray(item.locked_fields) ? item.locked_fields : [];

                // Unify locked field check for price (both typo and correct)
                const isPriceLocked = lockedFields.includes('average_cost') || lockedFields.includes('avarege_cost');

                let protectedCount = 0;

                lockedFields.forEach(field => {
                    if (fullUpdate.hasOwnProperty(field)) {
                        delete fullUpdate[field];
                        protectedCount++;
                    }
                });

                if (isPriceLocked && fullUpdate.avarege_cost) {
                    delete fullUpdate.avarege_cost;
                    protectedCount++;
                }

                // Legacy support: is_tracks_validated (backwards compatibility)
                if (item.is_tracks_validated && !lockedFields.includes('tracks')) {
                    delete fullUpdate.tracks;
                    protectedCount++;
                }

                // Log protection status
                if (protectedCount > 0) {
                    addLog(`🛡️ Protected ${protectedCount} field(s) from AI update`, "info");
                }

                // Update PocketBase with analysis results
                try {
                    await pb.collection('vinyls').update(item.id, fullUpdate);
                } catch (fullError) {
                    // Fallback to basic
                    const basicUpdate = {
                        artist: analysis.artist,
                        title: analysis.title,
                        genre: analysis.genre,
                        year: analysis.year
                    };
                    await pb.collection('vinyls').update(item.id, basicUpdate);
                }

                addLog(`✓ Success: ${analysis.artist} - ${analysis.title} `, "success");
                onUpdate(item.id, analysis); // Update parent state

                // Clear failure if successful
                if (failedIdsRef.current.has(item.id)) failedIdsRef.current.delete(item.id);
                consecutiveRetries = 0; // Reset retries

                // Pace it based on provider
                // Gemini Free: 4s (15 RPM)
                // OpenAI / Gemini Paid: 0.5s (High throughput)
                // Check if we need to force safe mode due to previous errors
                // FORCE STABILITY: Minimum 1s delay even for Turbo to prevent browser freeze
                const isTurbo = !forcedSafeModeRef.current && (getProvider() === 'openai' || (getProvider() === 'gemini' && getGeminiTier() === 'paid'));
                const delay = isTurbo ? 1000 : 6000;

                await new Promise(r => setTimeout(r, delay));

            } catch (err) {
                const msg = err.message.toLowerCase();

                if (msg.includes("quota") || msg.includes("limit") || msg.includes("429")) {
                    consecutiveRetries++;

                    // SAFETY VALVE: Stop infinite cycles after 20 tries
                    if (consecutiveRetries > 20) {
                        addLog("❌ Critical: Too many retries (20). Skipping item to save browser.", "error");
                        failedIdsRef.current.add(item.id);
                        await pb.collection('vinyls').update(item.id, { artist: 'Error', notes: 'Max retries exceeded' });
                        consecutiveRetries = 0;
                        setIsRetrying(false);
                        continue; // Proceed to next item
                    }

                    // 1. AUTO-DOWNGRADE to Safe Mode if blocking in Turbo
                    // Check if it *was* turbo before considering forcedSafeModeRef
                    const wasTurbo = (getProvider() === 'openai' || (getProvider() === 'gemini' && getGeminiTier() === 'paid'));

                    if (wasTurbo && !forcedSafeModeRef.current) {
                        addLog(`⚠ Turbo Limit Reached.Auto - switching to Safe Mode(6s).`, "warning");
                        forcedSafeModeRef.current = true;
                        consecutiveRetries = 0; // Reset count for fresh start in safe mode
                        i--;
                        continue;
                    }

                    // 2. INFINITE EXPONENTIAL BACKOFF (Never Give Up on Rate Limits)
                    // Wait starts at 5s, increases by 1.5x each time, caps at 60s.
                    const waitSeconds = Math.min(60, Math.round(5 * Math.pow(1.5, consecutiveRetries)));

                    setIsRetrying(true);
                    shouldSkipRef.current = false;

                    const warningMsg = consecutiveRetries > 4
                        ? `⚠ Limit Persistent(Retry ${consecutiveRetries}).Daily Quota likely reached.Try Skip / Stop.`
                        : `⚠ Rate Limit Hit(Retry ${consecutiveRetries}).Waiting ${waitSeconds}s...`;
                    addLog(warningMsg, consecutiveRetries > 4 ? "error" : "warning");

                    // Visual Countdown
                    for (let s = waitSeconds; s > 0; s--) {
                        if (shouldStopRef.current || shouldSkipRef.current) break;
                        if (s % 5 === 0 || s <= 3) addLog(`Resuming in ${s}s...`, "info");
                        await new Promise(r => setTimeout(r, 1000));
                    }

                    if (shouldSkipRef.current) {
                        addLog(`⚠ Item skipped by user.`, "error");
                        failedIdsRef.current.add(item.id);
                        await pb.collection('vinyls').update(item.id, { artist: 'Error', notes: 'Skipped by user' });
                        consecutiveRetries = 0;
                        setIsRetrying(false);
                    } else if (!shouldStopRef.current) {
                        i--; // Infinite Retry
                    } else {
                        setIsRetrying(false);
                    }

                } else {
                    addLog(`✗ Error: ${err.message} `, "error");
                    failedIdsRef.current.add(item.id);
                    await pb.collection('vinyls').update(item.id, { artist: 'Error', notes: err.message });
                    consecutiveRetries = 0; // Reset for next
                }
            }
        }

        setIsProcessing(false);
        setProgress(100);
        addLog("Batch analysis finished!", "success");
        if (onComplete) onComplete();
    };

    const stopBatch = () => {
        shouldStopRef.current = true;
        addLog("Stopping...", "warning");
    };

    // Watchdog: Ensure processing never dies (Hard Reset)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceActivity = now - lastActivityRef.current;

            // Stuck Detect: Processing but silent for > 5 minutes
            if (isProcessing && timeSinceActivity > 300000) {
                console.log("Watchdog: Process HUNG. Force restarting...");
                addLog("⚠ System Hung (No activity 5m). Force restarting...", "warning");
                setIsProcessing(false);
                shouldStopRef.current = false;
                // Restart auto (quiet)
                setTimeout(() => startBatch(null, true), 1000);
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [isProcessing, pendingItems]);


    // VISIBILITY LOGIC:
    if (pendingItems.length === 0 && incompleteItems.length === 0 && !isProcessing && !isExpanded) return null;

    if (!isExpanded) {
        return (
            <div className="w-full max-w-4xl mx-auto mb-8 bg-black/40 border border-white/10 rounded-lg p-3 flex items-center justify-between shadow-lg backdrop-blur-md animate-in fade-in">
                <div className="flex items-center gap-3">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                    <div>
                        <p className="text-sm font-medium text-white">
                            {isProcessing
                                ? `Analyzing records... ${progress}% `
                                : pendingItems.length > 0
                                    ? `${pendingItems.length} new records detected.`
                                    : `${incompleteItems.length} records missing Estimated Value.`
                            }
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isProcessing && (
                        <>
                            {pendingItems.length > 0 && (
                                <button onClick={() => startBatch(pendingItems, false)} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${pendingItems.some(i => i.artist === 'Error') ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary text-black hover:bg-white'} `}>
                                    {pendingItems.some(i => i.artist === 'Error') ? 'Retry Failures' : 'Start Analysis'}
                                </button>
                            )}
                            {pendingItems.length === 0 && incompleteItems.length > 0 && (
                                <button onClick={() => startBatch(incompleteItems, false)} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded border border-emerald-500/50 hover:bg-emerald-500/20 transition-colors">
                                    Enhance {incompleteItems.length} Records
                                </button>
                            )}
                        </>
                    )}
                    <button onClick={() => setIsExpanded(true)} className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20 transition-colors">
                        Show Logs
                    </button>
                </div>
            </div>
        );
    }

    const hasErrors = pendingItems.some(v => v.artist === 'Error');

    return (
        <div className="w-full max-w-4xl mx-auto mb-8">
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-black/40 p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-primary" />
                        <h3 className="font-mono font-medium text-primary">AI Processing Console</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs text-secondary mb-1">Progress</p>
                            <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}% ` }} />
                            </div>
                        </div>
                        {isRetrying && (
                            <button
                                onClick={() => shouldSkipRef.current = true}
                                className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded hover:bg-red-500/30 transition-colors border border-red-500/30 animate-pulse mr-2"
                            >
                                Skip Item
                            </button>
                        )}
                        <button
                            onClick={() => setIsExpanded(false)}
                            disabled={isProcessing}
                            className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Console Logs */}
                <div className="h-64 overflow-y-auto p-4 font-mono text-sm bg-black/40 backdrop-blur-md space-y-1 scroll-smooth">
                    {logs.length === 0 && <p className="text-secondary opacity-50 italic">Ready to start...</p>}
                    {logs.map((log, i) => (
                        <div key={i} className={`flex gap - 3 ${log.type === 'error' ? 'text-red-400' :
                            log.type === 'warning' ? 'text-yellow-400' :
                                log.type === 'success' ? 'text-green-400' : 'text-secondary'
                            } `}>
                            <span className="opacity-50 select-none">[{log.time}]</span>
                            <span>{log.msg}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border bg-black/20 flex justify-between items-center">
                    <div className="text-xs text-secondary">
                        {isProcessing ? "Please keep this window open." : "Job complete."}
                    </div>
                    {isProcessing ? (
                        <button
                            onClick={stopBatch}
                            className="flex items-center gap-2 bg-red-500/10 text-red-500 px-4 py-2 rounded-lg hover:bg-red-500/20 border border-red-500/50 transition-colors"
                        >
                            <Pause className="w-4 h-4" /> Stop
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            {pendingItems.length > 0 && (
                                <button
                                    onClick={() => startBatch(pendingItems, false)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${hasErrors
                                        ? 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20'
                                        : 'bg-primary/10 text-primary border-primary/50 hover:bg-primary/20'
                                        } `}
                                >
                                    <Play className="w-4 h-4" />
                                    {hasErrors ? 'Retry Failures' : 'Resume New'}
                                </button>
                            )}
                            {incompleteItems.length > 0 && (
                                <button
                                    onClick={() => startBatch(incompleteItems, false)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    Enhance {incompleteItems.length} Existing
                                </button>
                            )}
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="px-4 py-2 text-secondary hover:text-primary transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
