migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("vinyls");
    console.log(">> Fields JSON: " + JSON.stringify(collection.fields));
    const fields = collection.fields;
    console.log(">> Fields count: " + fields.length);
    for (let i = 0; i < fields.length; i++) {
        console.log("   Field [" + i + "]: name=" + fields[i].name + ", type=" + fields[i].type);
    }
  } catch (err) {
      console.error(">> Inspection Failed: " + err);
  }
}, (app) => {})
