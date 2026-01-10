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
    .setProject('67812969000f94b7e551');

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
        console.error("Error:", e);
    }
}

check();
