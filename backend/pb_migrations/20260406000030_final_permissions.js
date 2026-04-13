migrate((app) => {
  try {
    console.log(">> Finalizing Public Permissions via SQL...");
    app.db().newQuery("UPDATE _collections SET listRule='', viewRule='', createRule='', updateRule='', deleteRule='' WHERE name='vinyls'").execute();
    console.log("✅ Public permissions finalized.");
  } catch (err) {
    console.error(">> Permissions Migration Failed:", err);
  }
}, (app) => {})
