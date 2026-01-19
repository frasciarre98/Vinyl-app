import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { SettingsModal } from './components/SettingsModal';
import { UploadModal } from './components/UploadModal';
import { VinylGrid } from './components/VinylGrid';
import { DebugModal } from './components/DebugModal';

function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <Layout
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenDebug={() => setIsDebugOpen(true)}
        >
            <VinylGrid
                refreshTrigger={refreshTrigger}
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
            />

            <DebugModal
                isOpen={isDebugOpen}
                onClose={() => setIsDebugOpen(false)}
            />
        </Layout>
    );
}

export default App;
