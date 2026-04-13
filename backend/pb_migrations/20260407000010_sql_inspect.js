migrate((app) => {
  try {
    const query = app.db().newQuery("SELECT fields FROM _collections WHERE name='vinyls'");
    const results = [];
    query.all(results);
    if (results.length > 0) {
        console.log(">> RAW FIELDS JSON FROM DB:");
        console.log(JSON.stringify(results[0].fields));
    }
  } catch (err) {
    console.error(">> SQL Inspection Failed: " + err);
  }
}, (app) => {})
