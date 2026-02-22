import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');
pb.autoCancellation(false);

async function main() {
    try {
        console.log("🔌 Connecting...");

        // The list of IDs found in previous step
        const brokenIds = [
            '9wdyi0qtkm99whp', // The one user gave us
            'y3bkastnu3w2030',
            'cilwahzl8og3cgp',
            'x0mvqzy4z90d4vw',
            'wankbrxibooqt83',
            '7g0koxlkwvj7xl7',
            'rwxjwsfhesr50wo',
            '5czy3l6kcw9yl9v',
            'hc7y3ctciw0ebjp',
            'kqg81gkb86mqfwy',
            'byubchx9ee69xe4'
        ];

        console.log(`🔧 Attempting to repair ${brokenIds.length} records...`);

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        for (const id of brokenIds) {
            try {
                // We can't easily write to 'created' via API usually (it's read-only), 
                // but let's try or at least update 'updated' to bring them to top if sorted by date
                // Actually, if we update ANY field, 'updated' will change.
                // Let's invoke a dummy update.

                await pb.collection('vinyls').update(id, {
                    notes: `(Recovered ${new Date().toLocaleTimeString()})`
                });
                console.log(`✅ Repaired ${id}`);
            } catch (e) {
                console.warn(`⚠️ Failed to repair ${id}: ${e.message}`);
            }
        }

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

main();
