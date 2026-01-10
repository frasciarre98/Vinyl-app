import { Client, Databases } from 'appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('69622969000f94b7e551');

const databases = new Databases(client);
const DATABASE_ID = 'vinyl_db';
const COLLECTION_ID = 'vinyls';

async function checkSchema() {
    console.log("Checking attributes for 'vinyls' collection...");
    try {
        const response = await databases.listAttributes(DATABASE_ID, COLLECTION_ID);
        const formatAttr = response.attributes.find(a => a.key === 'format');

        if (formatAttr) {
            console.log("Found 'format' attribute:", JSON.stringify(formatAttr, null, 2));
        } else {
            console.log("'format' attribute NOT found!");
        }
    } catch (err) {
        console.error("Failed to list attributes:", err.message);
    }
}

checkSchema();
