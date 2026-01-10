import { Client, Databases, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('69622969000f94b7e551');

const databases = new Databases(client);
const DATABASE_ID = 'vinyl_db';

async function testCost() {
    console.log("Testing avarege_cost type...");

    // Test 1: String
    try {
        await databases.createDocument(DATABASE_ID, 'vinyls', ID.unique(), {
            artist: 'Test String',
            title: 'Test Title 1',
            format: 'Vinyl',
            original_filename: 'test.jpg',
            avarege_cost: "100" // String
        });
        console.log("Success: avarege_cost accepts STRING");
    } catch (err) {
        console.log("Failed STRING:", err.message);
    }

    // Test 2: Integer
    try {
        await databases.createDocument(DATABASE_ID, 'vinyls', ID.unique(), {
            artist: 'Test Int',
            title: 'Test Title 2',
            format: 'Vinyl',
            original_filename: 'test.jpg',
            avarege_cost: 100 // Int
        });
        console.log("Success: avarege_cost accepts INTEGER");
    } catch (err) {
        console.log("Failed INTEGER:", err.message);
    }
}

testCost();
