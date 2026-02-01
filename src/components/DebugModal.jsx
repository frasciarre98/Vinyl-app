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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="glass-heavy rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-red-500">
                        <Bug className="w-5 h-5" /> Debug Tools
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-black/10 p-4 rounded-lg border border-white/10">
                            <h3 className="font-medium mb-2 flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-primary" /> Database Consistency
                            </h3>
                            <p className="text-sm text-secondary mb-4">
                                Check for records with missing or invalid formats.
                            </p>
                            <button
                                onClick={checkFormats}
                                disabled={isLoading}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mb-2"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Check Formats'}
                            </button>
                            <button
                                onClick={fixSchema}
                                disabled={isLoading}
                                className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Wrench className="w-4 h-4" /> Fix Missing Fields (Price/Year)
                            </button>
                        </div>

                        <div className="bg-black/10 p-4 rounded-lg border border-white/10">
                            <h3 className="font-medium mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-primary" /> Image Diagnostics
                            </h3>
                            <p className="text-sm text-secondary mb-4">
                                Test if the last image is accessible.
                            </p>
                            <button
                                onClick={checkLastImage}
                                disabled={isLoading}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test Last Image'}
                            </button>
                        </div>
                    </div>

                    {/* Auth Section */}
                    <div className="bg-black/10 p-4 rounded-lg border border-white/10 flex items-center justify-between">
                        <div>
                            <h3 className="font-medium flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" /> Admin Access
                            </h3>
                            <p className="text-sm text-secondary">
                                {currentUser ? `Logged in as: ${currentUser.email}` : 'Log in to edit records.'}
                            </p>
                        </div>
                        {currentUser ? (
                            <button
                                onClick={handleLogout}
                                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" /> Logout
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsLoginOpen(true)}
                                className="bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <Lock className="w-4 h-4" /> Login
                            </button>
                        )}
                    </div>


                    <div className="bg-black/10 rounded-lg p-4 font-mono text-xs border border-white/5 h-64 overflow-y-auto">
                        {logs.length === 0 ? (
                            <div className="text-secondary italic text-center mt-20">Logs will appear here...</div>
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
