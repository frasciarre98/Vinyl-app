import React, { useState } from 'react';
import { X, Lock, LogIn, Loader2 } from 'lucide-react';
import { pb } from '../lib/pocketbase';

export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await pb.admins.authWithPassword(email, password);
            if (onLoginSuccess) onLoginSuccess();
            onClose();
        } catch (err) {
            console.error("Login failed:", err);
            // Try as regular auth user if admin fails (just in case they use that)
            try {
                await pb.collection('users').authWithPassword(email, password);
                if (onLoginSuccess) onLoginSuccess();
                onClose();
            } catch (err2) {
                setError("Invalid email or password.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                        <Lock className="w-4 h-4 text-primary" /> Admin Login
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleLogin} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-secondary">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary outline-none"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-secondary">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary outline-none"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                        {loading ? 'Authenticating...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
