const { Admin, Client } = require('pocketbase');
require('cross-fetch/polyfill');

const pb = new Client('http://127.0.0.1:8090');

async function appendSchemaField() {
    try {
        console.log("Authenticating as admin...");
        await pb.admins.authWithPassword('fra.asciarre98@gmail.com', 'Juventus98!');

        console.log("Fetching vinyls collection...");
        const collection = await pb.collections.getOne('vinyls');

        // Check if field already exists
        const fieldExists = collection.schema.find(f => f.name === 'liner_notes');
        if (fieldExists) {
            console.log("Field 'liner_notes' already exists. Exiting.");
            return;
        }

        console.log("Adding liner_notes field...");
        collection.schema.push({
            "system": false,
            "id": "liner_notes_ai_story",
            "name": "liner_notes",
            "type": "text",
            "required": false,
            "presentable": false,
            "unique": false,
            "options": {
                "min": null,
                "max": null,
                "pattern": ""
            }
        });

        await pb.collections.update('vinyls', collection);
        console.log("Successfully added 'liner_notes' field to 'vinyls' collection.");

    } catch (err) {
        console.error("Error migrating schema:", err);
        process.exit(1);
    }
}

appendSchemaField();
