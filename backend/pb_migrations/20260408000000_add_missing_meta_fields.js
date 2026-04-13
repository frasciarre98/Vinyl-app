migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("vinyls");
    if (!collection) return;

    console.log(">> Adding missing metadata fields (average_cost, group_members, format)...");
    
    const fields = [
      { name: "average_cost", type: "text" },
      { name: "group_members", type: "text" },
      { name: "format", type: "text" }
    ];

    for (const f of fields) {
      try {
        collection.fields.add(new core.TextField({ name: f.name }));
        console.log(`✅ Field '${f.name}' added.`);
      } catch (e) {
        console.log(`>> Field '${f.name}' already exists or failed to add.`);
      }
    }

    app.save(collection);
    console.log("✅ Schema updated successfully.");

  } catch (err) {
    console.error(">> Schema Update Migration Failed:", err);
  }
}, (app) => {})
