import React, { useState } from 'react';
import { X, Wrench, Bug, RefreshCw, AlertTriangle } from 'lucide-react';
import { databases, DATABASE_ID } from '../lib/appwrite';
import { Query } from 'appwrite';

export function DebugModal({ isOpen, onClose }) {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const log = (msg, type = 'info') => {
        setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    };

    const checkFormats = async () => {
        setIsLoading(true);
        log('Starting Format Check...', 'info');
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                'vinyls',
                [
                    Query.limit(100),
                    Query.orderDesc('$createdAt')
                ]
            );

            log(`Fetched ${response.documents.length} recent records.`, 'info');

            const stats = response.documents.reduce((acc, doc) => {
                acc[doc.format] = (acc[doc.format] || 0) + 1;
                return acc;
            }, {});

            log(`Format Stats: ${JSON.stringify(stats)}`, 'info');

            const potentialIssues = response.documents.filter(doc => !doc.format || (doc.format !== 'Vinyl' && doc.format !== 'CD'));

            if (potentialIssues.length > 0) {
                log(`Found ${potentialIssues.length} records with unknown formats!`, 'error');
                potentialIssues.forEach(doc => {
                    log(`- ${doc.title}: ${doc.format}`, 'warning');
                });
            } else {
                log('No unknown formats found in recent records.', 'success');
            }

        } catch (err) {
            log(`Error: ${err.message}`, 'error');
            console.error(err);
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
            const list = await databases.listDocuments(DATABASE_ID, 'vinyls', [Query.limit(1), Query.orderDesc('$createdAt')]);
            if (list.documents.length === 0) {
                log('No records found.', 'warning');
                return;
            }
            const doc = list.documents[0];
            const url = doc.image_url;
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
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
                        <div className="bg-background p-4 rounded-lg border border-border">
                            <h3 className="font-medium mb-2 flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-primary" /> Database Consistency
                            </h3>
                            <p className="text-sm text-secondary mb-4">
                                Check for records with missing or invalid formats.
                            </p>
                            <button
                                onClick={checkFormats}
                                disabled={isLoading}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Check Formats'}
                            </button>
                        </div>

                        <div className="bg-background p-4 rounded-lg border border-border">
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

                    <div className="bg-black/40 rounded-lg p-4 font-mono text-xs border border-white/5 h-64 overflow-y-auto">
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
            </div>
        </div>
    );
}
