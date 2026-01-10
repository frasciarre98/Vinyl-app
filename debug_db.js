import { Client, Databases } from 'appwrite';

// Mock browser env
global.localStorage = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { }
};
global.window = {};

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('69622969000f94b7e551');

const databases = new Databases(client);

async function check() {
    try {
        const response = await databases.listDocuments(
            'vinyl_db',
            'vinyls',
            []
        );

        console.log("Documents Found:", response.total);
        if (response.documents.length > 0) {
            console.log("First Document Keys:", Object.keys(response.documents[0]));
            console.log("First Document Data:", JSON.stringify(response.documents[0], null, 2));

            // Check specifically for format
            const docWithFormat = response.documents.find(d => d.format === 'CD');
            if (docWithFormat) {
                console.log("Found a CD:", docWithFormat.title);
            } else {
                console.log("No CD format found in recent docs.");
            }
        }
    } catch (e) {
        console.error("Read Error:", e);
    }

    try {
        console.log("Testing Write Permission...");
        await databases.createDocument(
            'vinyl_db',
            'vinyls',
            'unique()',
            {
                artist: 'Debug Test',
                title: 'Permission Check',
                format: 'Vinyl'
            }
        );
        console.log("✅ Write Permission: SUCCESS!");

        // Save ID for delete test
        const testId = 'unique()'; // Note: In the previous step we used unique(), so we can't easily grab the ID unless we got it from the response. 
        // For simplicity, let's create a KNOWN ID to delete.
    } catch (e) {
        console.error("❌ Write Permission FAILED:", e.message);
    }

    try {
        console.log("Testing Delete Permission...");
        // We'll try to create then delete a specific test document
        const testDoc = await databases.createDocument('vinyl_db', 'vinyls', 'test-delete-permission', { format: 'Vinyl', title: 'To Delete', artist: 'To Delete' });
        console.log("Created temp doc for delete test...");
        await databases.deleteDocument('vinyl_db', 'vinyls', testDoc.$id);
        console.log("✅ Delete Permission: SUCCESS!");
    } catch (e) {
        console.log("❌ Delete Permission FAILED:", e.message);
    }
}

check();
