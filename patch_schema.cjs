const { execSync } = require('child_process');
const fs = require('fs');

try {
    // 1. Get current fields JSON - ensure we only get the JSON string
    console.log("Reading schema...");
    const jsonStr = execSync('sqlite3 backend/pb_data/data.db "SELECT fields FROM _collections WHERE name=\'vinyls\';"').toString().trim();

    if (!jsonStr) {
        console.error("Could not read fields for vinyls");
        process.exit(1);
    }

    let fields;
    try {
        fields = JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON:", jsonStr);
        throw e;
    }

    console.log(`Current fields count: ${fields.length}`);

    // 2. Add created/updated if missing
    let modified = false;

    // Check if created exists
    if (!fields.find(f => f.name === 'created')) {
        console.log("Adding 'created' field definition...");
        fields.push({
            "system": false,
            "id": "pb_created_date",
            "name": "created",
            "type": "autodate",
            "presentable": false,
            "required": false,
            "unique": false,
            "options": {
                "onCreate": true,
                "onUpdate": false
            }
        });
        modified = true;
    }

    // Check if updated exists
    if (!fields.find(f => f.name === 'updated')) {
        console.log("Adding 'updated' field definition...");
        fields.push({
            "system": false,
            "id": "pb_updated_date",
            "name": "updated",
            "type": "autodate",
            "presentable": false,
            "required": false,
            "unique": false,
            "options": {
                "onCreate": true,
                "onUpdate": true
            }
        });
        modified = true;
    }

    if (modified) {
        const newJsonStr = JSON.stringify(fields);
        // Escape single quotes for SQL: ' becomes ''
        const sqlSafeJson = newJsonStr.replace(/'/g, "''");

        console.log("Writing back to DB...");

        // Use a temporary SQL file
        const updateSql = `UPDATE _collections SET fields='${sqlSafeJson}' WHERE name='vinyls';`;
        fs.writeFileSync('temp_patch.sql', updateSql);

        execSync('sqlite3 backend/pb_data/data.db < temp_patch.sql');
        console.log("Schema patched successfully!");

        fs.unlinkSync('temp_patch.sql');
    } else {
        console.log("Schema already has created/updated fields.");
    }

} catch (e) {
    console.error("Error:", e);
    process.exit(1);
}
