migrate((app) => {
  try {
    console.log(">> STARTING BACKEND HEALTH CHECK...");
    const collection = app.findCollectionByNameOrId("vinyls");
    if (!collection) {
        console.log("❌ CRITICAL: 'vinyls' collection NOT FOUND!");
        return;
    }

    console.log(">> Collection Rules State:");
    console.log("   List: '" + collection.listRule + "'");
    console.log("   View: '" + collection.viewRule + "'");

    // Test a simple query
    try {
        const records = app.findRecordsByFilter("vinyls", "1=1", "-created", 1, 0);
        console.log("✅ Successfully fetched " + records.length + " sample records in migration.");
    } catch (e) {
        console.error("❌ FAILED to fetch records in migration: " + e);
        // Try without sort
        try {
            const records = app.findRecordsByFilter("vinyls", "1=1", "", 1, 0);
            console.log("✅ Successfully fetched records without sort.");
        } catch (e2) {
            console.error("❌ CRITICAL: Failed to fetch records even without sort: " + e2);
        }
    }

    console.log(">> Fixing rules via Collection API (official way)...");
    collection.listRule = "";
    collection.viewRule = "";
    collection.createRule = "";
    collection.updateRule = "";
    collection.deleteRule = "";
    app.save(collection);
    console.log("✅ Collection API rules set to public.");

  } catch (err) {
    console.error(">> Health Check Migration Failed: " + err);
  }
}, (app) => {})
