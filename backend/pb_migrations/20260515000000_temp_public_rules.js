migrate((app) => {
  const collection = app.findCollectionByNameOrId('artists');
  collection.updateRule = ""; // Make public for repair
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('artists');
  collection.updateRule = "@request.auth.id != ''";
  app.save(collection);
})
