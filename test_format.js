import { Client, Databases, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('69622969000f94b7e551');

const databases = new Databases(client);
const DATABASE_ID = 'vinyl_db';

async function testFormat() {
    console.log("Testing format: 'CD'");
    try {
        const doc = await databases.createDocument(
            DATABASE_ID,
            'vinyls',
            ID.unique(),
            {
                artist: 'Test Artist',
                title: 'Test Title',
                format: 'CD',
                original_filename: 'test.jpg'
            }
        );
        console.log("Success! Created document with format:", doc.format);

        // Cleanup
        await databases.deleteDocument(DATABASE_ID, 'vinyls', doc.$id);
        console.log("Deleted test document.");
    } catch (err) {
        console.error("Failed to create document with format 'CD':", err.message);
    }
}

testFormat();
