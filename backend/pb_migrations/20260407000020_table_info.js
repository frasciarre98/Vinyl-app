migrate((app) => {
  try {
    const query = app.db().newQuery("PRAGMA table_info('_collections')");
    const results = [];
    // Just use a raw loop to print everything if possible
    console.log(">> PRAGMA table_info(_collections):");
    const rows = app.db().newQuery("SELECT * FROM _collections WHERE name='vinyls'").all();
    console.log(">> Vinyls collection raw row: " + JSON.stringify(rows[0]));
  } catch (err) {
    console.error(">> PRAGMA Inspection Failed: " + err);
  }
}, (app) => {})
