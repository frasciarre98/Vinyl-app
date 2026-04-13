migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("vinyls");
    if (!collection) return;

    console.log(">> Probing 'liner_notes' field...");
    try {
        collection.fields.add(new core.TextField({ name: "liner_notes" }));
        app.save(collection);
        console.log("✅ 'liner_notes' added.");
    } catch (e) {
        console.log(">> 'liner_notes' potentially already exists or failed: " + e);
    }
  } catch (err) {
      console.error(">> Schema Fix Migration Failed:", err);
  }
}, (app) => {})
