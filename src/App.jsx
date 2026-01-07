import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { SettingsModal } from './components/SettingsModal';
import { UploadModal } from './components/UploadModal';
import { VinylGrid } from './components/VinylGrid';
import { EditVinylModal } from './components/EditVinylModal';

function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [editingVinyl, setEditingVinyl] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <Layout
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenUpload={() => setIsUploadOpen(true)}
        >
            <VinylGrid
                refreshTrigger={refreshTrigger}
                onEdit={(vinyl) => setEditingVinyl(vinyl)}
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
            />

            <EditVinylModal
                isOpen={!!editingVinyl}
                vinyl={editingVinyl}
                onClose={() => setEditingVinyl(null)}
                onUpdate={handleRefresh}
            />
        </Layout>
    );
}

export default App;
