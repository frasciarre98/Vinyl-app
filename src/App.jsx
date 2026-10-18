import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SettingsModal } from './components/SettingsModal';
import { UploadModal } from './components/UploadModal';
import { VinylGrid } from './components/VinylGrid';
import { DebugModal } from './components/DebugModal';
import { pb } from './lib/pocketbase';

function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadInitialTab, setUploadInitialTab] = useState('music');
    const [uploadInitialQuery, setUploadInitialQuery] = useState('');
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showWantlist, setShowWantlist] = useState(false);

    const handleOpenUpload = (tab = 'music', query = '') => {
        setUploadInitialTab(tab);
        setUploadInitialQuery(query);
        setIsUploadOpen(true);
    };

    useEffect(() => {
        const autoLogin = async () => {
            if (!pb.authStore.isValid) {
                const email = localStorage.getItem('pb_admin_email');
                const password = localStorage.getItem('pb_admin_password');
                if (email && password) {
                    try {
                        console.log("🔄 Auto-authenticating from saved credentials...");
                        await pb.admins.authWithPassword(email, password);
                        setRefreshTrigger(prev => prev + 1); // trigger reload of grid
                    } catch (e) {
                        try {
                            await pb.collection('users').authWithPassword(email, password);
                            setRefreshTrigger(prev => prev + 1);
                        } catch(e2) {
                            console.error("Auto-auth failed", e2);
                        }
                    }
                }
            } else {
                 try {
                     if (pb.authStore.isAdmin) {
                         await pb.admins.authRefresh();
                     } else {
                         await pb.collection('users').authRefresh();
                     }
                 } catch (e) {
                     console.log("Token refresh failed, will use existing if still valid");
                 }
            }
        };
        autoLogin();
    }, []);

    const handleRefresh = () => {
        console.log('🔄 App: handleRefresh called, incrementing refreshTrigger from', refreshTrigger);
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <Layout
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenUpload={handleOpenUpload}
            onOpenDebug={() => setIsDebugOpen(true)}
        >
            <VinylGrid
                refreshTrigger={refreshTrigger}
                onWantlistChange={setShowWantlist}
                onOpenOnlineSearch={(query) => handleOpenUpload('music', query)}
            />

            {isSettingsOpen && (
                <SettingsModal
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={() => setIsSettingsOpen(false)}
                />
            )}

            <UploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUploadComplete={handleRefresh}
                onOpenDebug={() => setIsDebugOpen(true)}
                defaultIsWantlist={showWantlist}
                initialTab={uploadInitialTab}
                initialQuery={uploadInitialQuery}
            />

            <DebugModal
                isOpen={isDebugOpen}
                onClose={() => setIsDebugOpen(false)}
            />
        </Layout>
    );
}

export default App;
