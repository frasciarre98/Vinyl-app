
const { execSync } = require('child_process');

try {
    const fieldsToLock = JSON.stringify(["artist", "title", "label", "catalog_number", "edition"]);
    // Escape for SQL single quotes
    // JSON: ["a","b"] -> '["a","b"]'

    console.log(`Locking fields: ${fieldsToLock} for ALL records...`);

    const sql = `UPDATE vinyls SET locked_fields = '${fieldsToLock}';`;

    // Execute via sqlite3
    execSync(`sqlite3 backend/pb_data/data.db "${sql}"`);

    console.log("✅ All records have been locked with critical fields.");

    // Verify count
    const count = execSync('sqlite3 backend/pb_data/data.db "SELECT count(*) FROM vinyls WHERE locked_fields LIKE \'%artist%\';"').toString().trim();
    console.log(`Verified: ${count} records updated.`);

} catch (e) {
    console.error("Error batch locking:", e);
    process.exit(1);
}
