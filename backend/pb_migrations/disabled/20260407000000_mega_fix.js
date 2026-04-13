migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("vinyls");
    console.log(">> MEGA FIX - Inspecting vinyls collection...");
    // console.log(JSON.stringify(collection));

    // Fix rules immediately
    collection.listRule = "";
    collection.viewRule = "";
    collection.createRule = "";
    collection.updateRule = "";
    collection.deleteRule = "";

    // Fix the suspicious fields 23 and 24 if they exist and are autodate/date
    // Based on the error, they are likely Autodate fields added during upgrade
    const fields = collection.fields;
    console.log(">> Field Count: " + fields.length);
    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (f.type === "autodate" || f.type === "date") {
            console.log("   Found date field: " + f.name + " (index " + i + ")");
            // In 0.23+, Autodate fields have onCreate and onUpdate properties
            // If they are false, we must set at least one to true
            try {
                f.onCreate = true;
                f.onUpdate = true;
            } catch (e) {}
        }
    }

    app.save(collection);
    console.log("✅ Collection schema saved with public rules and fixed dates.");

    // Final data sync check
    const count = app.db().newQuery("SELECT count(*) FROM vinyls").execute();
    console.log(">> Record count in DB: " + JSON.stringify(count));

  } catch (err) {
    console.error(">> MEGA FIX FAILED: " + err);
  }
}, (app) => {})
