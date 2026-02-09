
const { execSync } = require('child_process');
const fs = require('fs');

try {
    // 1. Get current fields JSON
    console.log("Reading schema...");
    const jsonStr = execSync('sqlite3 backend/pb_data/data.db "SELECT fields FROM _collections WHERE name=\'vinyls\';"').toString().trim();

    if (!jsonStr) {
        console.error("Could not read fields for vinyls");
        process.exit(1);
    }

    const fields = JSON.parse(jsonStr);
    console.log(`Current fields count: ${fields.length}`);

    // 2. Add created/updated if missing
    let modified = false;

    if (!fields.find(f => f.name === 'created')) {
        console.log("Adding 'created' field...");
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

    if (!fields.find(f => f.name === 'updated')) {
        console.log("Adding 'updated' field...");
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
        // Escape single quotes for SQL
        const sqlSafeJson = newJsonStr.replace(/'/g, "''");

        console.log("Writing back to DB...");
        // Use a temporary file for the SQL to avoid escaping/shell length issues
        const sql = `UPDATE _collections SET fields='${sqlSafeJson}' WHERE name='vinyls';`;
        fs.writeFileSync('update_schema.sql', sql);

        execSync('sqlite3 backend/pb_data/data.db < update_schema.sql');
        console.log("Schema patched successfully!");
        fs.unlinkSync('update_schema.sql');
    } else {
        console.log("Schema already has created/updated fields.");
    }

} catch (e) {
    console.error("Error:", e);
    process.exit(1);
}
