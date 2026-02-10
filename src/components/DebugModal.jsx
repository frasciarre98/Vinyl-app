import React, { useState, useEffect } from 'react';
import { X, Wrench, Bug, RefreshCw, AlertTriangle, Lock, LogOut } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { LoginModal } from './LoginModal';

export function DebugModal({ isOpen, onClose }) {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(pb.authStore.model);

    useEffect(() => {
        // Subscribe to auth changes
        const unsub = pb.authStore.onChange((token, model) => {
            setCurrentUser(model);
        });
        return () => unsub();
    }, []);

    if (!isOpen) return null;

    const log = (msg, type = 'info') => {
        setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    };

    const handleLogout = () => {
        pb.authStore.clear();
        log('Logged out.', 'success');
    };

    const checkFormats = async () => {
        setIsLoading(true);
        log('Starting Format Check...', 'info');
        try {
            // Simplified query to debug 400 error
            const records = await pb.collection('vinyls').getList(1, 50);
            const documents = records.items;

            log(`Fetched ${documents.length} recent records.`, 'info');

            const stats = documents.reduce((acc, doc) => {
                acc[doc.format] = (acc[doc.format] || 0) + 1;
                return acc;
            }, {});

            log(`Format Stats: ${JSON.stringify(stats)}`, 'info');

            const potentialIssues = documents.filter(doc => !doc.format || (doc.format !== 'Vinyl' && doc.format !== 'CD'));

            if (potentialIssues.length > 0) {
                log(`Found ${potentialIssues.length} records with unknown formats!`, 'error');
                potentialIssues.forEach(doc => {
                    log(`- ${doc.title}: ${doc.format}`, 'warning');
                });
            } else {
                log('No unknown formats found in recent records.', 'success');
            }

        } catch (err) {
            const detailedMsg = err.data?.message || err.message;
            log(`Error: ${detailedMsg} (Status: ${err.status})`, 'error');
            log(`Raw Data: ${JSON.stringify(err.data)}`, 'warning');
            console.error("Full Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // This checks for the specific issue where user said things are 'Vinyl' but should be 'CD'
    // Since we can't know for sure, we just list 'Vinyl' records that might be suspicious (optional)
    // For now, let's just inspect.

    const checkLastImage = async () => {
        setIsLoading(true);
        log('Checking last image...', 'info');
        try {
            const list = await pb.collection('vinyls').getList(1, 1, { sort: '-created' });
            if (list.items.length === 0) {
                log('No records found.', 'warning');
                return;
            }
            const doc = list.items[0];
            const url = pb.files.getUrl(doc, doc.image);
            log(`Last Image URL: ${url}`, 'info');

            if (!url) {
                log('No image URL in record.', 'error');
                return;
            }

            const res = await fetch(url);
            log(`Fetch Status: ${res.status}`, res.ok ? 'success' : 'error');
            const type = res.headers.get('content-type');
            log(`Content-Type: ${type}`, 'info');

            if (!res.ok) {
                const text = await res.text();
                log(`Response Body: ${text.substring(0, 100)}`, 'error');
            } else {
                if (type && type.includes('image')) {
                    log('Image type looks correct.', 'success');
                } else {
                    log('WARNING: Not an image content type!', 'warning');
                }
            }

        } catch (err) {
            log(`Check failed: ${err.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fixSchema = async () => {
        setIsLoading(true);
        log('Starting Schema Repair...', 'info');
        try {
            if (!pb.authStore.isValid) {
                log('Not logged in. Please login as Admin.', 'error');
                return;
            }

            // 1. Find the collection by name from the full list
            const collections = await pb.collections.getFullList();
            const collection = collections.find(c => c.name === 'vinyls');

            if (!collection) {
                log('CRITICAL: Collection "vinyls" not found!', 'error');
                return;
            }

            log(`Found collection "${collection.name}" (ID: ${collection.id})`, 'info');

            // Fetch the specific collection to ensure we have the latest metadata
            const fullCollection = await pb.collections.getOne(collection.id);

            // PocketBase v0.22+ uses 'fields', older versions use 'schema'
            let isV22 = false;
            let currentFields = [];

            if (fullCollection.fields && Array.isArray(fullCollection.fields)) {
                isV22 = true;
                currentFields = [...fullCollection.fields];
                log('Detected PocketBase v0.22+ (using "fields")', 'info');
            } else if (fullCollection.schema && Array.isArray(fullCollection.schema)) {
                currentFields = [...fullCollection.schema];
                log('Detected PocketBase < v0.22 (using "schema")', 'info');
            } else {
                // Fallback: maybe empty schema?
                currentFields = [];
                log('No existing fields/schema found. Starting fresh.', 'warning');
            }

            let changed = false;
            const existingNames = currentFields.map(f => f.name);

            // 2. Define fields to add
            const fieldsToAdd = [
                { name: 'purchase_price', type: 'text', required: false, options: { pattern: "" } },
                { name: 'purchase_year', type: 'text', required: false, options: { pattern: "" } }
            ];

            fieldsToAdd.forEach(field => {
                if (!existingNames.includes(field.name)) {
                    log(`Adding missing field: ${field.name}`, 'warning');
                    currentFields.push({
                        system: false,
                        id: '', // let PB generate it
                        name: field.name,
                        type: field.type,
                        required: field.required,
                        presentable: false,
                        unique: false,
                        options: field.options
                    });
                    changed = true;
                }
            });

            if (changed) {
                log('Sending update...', 'info');
                // Construct payload based on version
                const payload = isV22 ? { fields: currentFields } : { schema: currentFields };

                await pb.collections.update(collection.id, payload);
                log('✅ Structure updated successfully!', 'success');
                log('Please close this modal and try saving again.', 'info');
            } else {
                log('Structure is already correct.', 'success');
            }

        } catch (err) {
            const detailedMsg = err.data?.message || err.message;
            log(`❌ Fix Failed: ${detailedMsg}`, 'error');
            console.error("Full Error:", err);
            if (err.data) log(`Details: ${JSON.stringify(err.data)}`, 'warning');
        } finally {
            setIsLoading(false);
        }
    };

    const cleanupUSD = async () => {
        if (!confirm("Start DB Cleanup? This will convert 'USD' to '€' in all records.")) return;
        setLoading(true);
        log('Starting USD to EUR cleanup...', 'info');
        try {
            const result = await pb.collection('vinyls').getFullList();
            let count = 0;
            for (const r of result) {
                if (!r.average_cost) continue;
                let cost = String(r.average_cost);
                if (cost.match(/USD|U\.S\.D|Dollar|\$/i)) {
                    // Sanitize
                    let newCost = cost.replace(/USD|U\.S\.D|Dollar|\$/gi, "").trim();
                    newCost = newCost.replace(/\.+$/, "").trim();
                    if (!newCost.includes("€") && !newCost.includes("EUR")) {
                        if (/\d/.test(newCost)) newCost = "€" + newCost;
                    }
                    if (newCost.includes("EUR")) newCost = newCost.replace("EUR", "€").trim();

                    if (newCost !== cost) {
                        await pb.collection('vinyls').update(r.id, { average_cost: newCost });
                        count++;
                        log(`Fixed ${r.id}: ${cost} -> ${newCost}`, 'success');
                    }
                }
            }
            log(`Cleanup Complete. Fixed ${count} records.`, 'success');
            // window.location.reload(); // Removed reload for better UX, user can close modal
        } catch (e) {
            log(`Cleanup failed: ${e.message}`, 'error');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 rounded-t-xl">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Bug className="w-6 h-6 text-red-500" /> Debug & Maintenance
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 bg-zinc-950/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 shadow-md">
                            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-white">
                                <Wrench className="w-5 h-5 text-yellow-500" /> Database Consistency
                            </h3>
                            <p className="text-sm text-zinc-400 mb-4">
                                Fix data quality issues and missing fields.
                            </p>

                            <button
                                onClick={cleanupUSD}
                                disabled={isLoading}
                                className="w-full py-3 mb-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-5 h-5" />
                                {isLoading ? "Cleaning..." : "FIX CURRENCY (USD -> €)"}
                            </button>

                            <button
                                onClick={checkFormats}
                                disabled={isLoading}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mb-2"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Check Formats'}
                            </button>
                            <button
                                onClick={fixSchema}
                                disabled={isLoading}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-yellow-400 px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Wrench className="w-4 h-4" /> Fix Missing Fields
                            </button>
                        </div>

                        <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 shadow-md">
                            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-white">
                                <AlertTriangle className="w-4 h-4 text-orange-500" /> Image Diagnostics
                            </h3>
                            <p className="text-sm text-zinc-400 mb-4">
                                Test if the last image is accessible.
                            </p>
                            <button
                                onClick={checkLastImage}
                                disabled={isLoading}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test Last Image'}
                            </button>
                        </div>
                    </div>

                    {/* Auth Section */}
                    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 shadow-md flex items-center justify-between">
                        <div>
                            <h3 className="font-bold flex items-center gap-2 text-white">
                                <Lock className="w-4 h-4 text-emerald-500" /> Admin Access
                            </h3>
                            <p className="text-sm text-zinc-400">
                                {currentUser ? `Logged in as: ${currentUser.email}` : 'Log in to edit records.'}
                            </p>
                        </div>
                        {currentUser ? (
                            <button
                                onClick={handleLogout}
                                className="bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 font-semibold"
                            >
                                <LogOut className="w-4 h-4" /> Logout
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsLoginOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 font-bold shadow-lg"
                            >
                                <Lock className="w-4 h-4" /> Login
                            </button>
                        )}
                    </div>


                    <div className="bg-black rounded-lg p-4 font-mono text-xs border border-zinc-800 h-64 overflow-y-auto text-green-400">
                        {logs.length === 0 ? (
                            <div className="text-zinc-600 italic text-center mt-20">Logs will appear here...</div>
                        ) : (
                            logs.map((l, i) => (
                                <div key={i} className={`mb-1 ${l.type === 'error' ? 'text-red-400' :
                                    l.type === 'success' ? 'text-green-400' :
                                        l.type === 'warning' ? 'text-yellow-400' :
                                            'text-blue-300'
                                    }`}>
                                    <span className="opacity-50">[{l.time}]</span> {l.msg}
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <LoginModal
                    isOpen={isLoginOpen}
                    onClose={() => setIsLoginOpen(false)}
                    onLoginSuccess={() => log("Logged in successfully!", "success")}
                />
            </div >
        </div>
    );
}
