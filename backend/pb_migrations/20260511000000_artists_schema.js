migrate((app) => {
  try {
    const existing = app.findCollectionByNameOrId('artists');
    if (existing) return;
  } catch (e) {
    const collection = new Collection({
      'name': 'artists',
      'type': 'base',
      'fields': [
        { 'id': 'text_name', 'name': 'name', 'type': 'text', 'required': true, 'unique': true },
        { 'id': 'text_bio', 'name': 'bio', 'type': 'text' },
        { 'id': 'text_funfact', 'name': 'fun_fact', 'type': 'text' },
        { 'id': 'text_img', 'name': 'image_url', 'type': 'text' }
      ]
    });
    
    // Set rule permissions (Viewable by anyone, creatable/updatable by auth users)
    collection.listRule = "";
    collection.viewRule = "";
    collection.createRule = "@request.auth.id != ''";
    collection.updateRule = "@request.auth.id != ''";
    collection.deleteRule = "@request.auth.id != ''";

    app.save(collection);
  }
}, (app) => {
  try {
    const existing = app.findCollectionByNameOrId('artists');
    if (existing) {
      app.delete(existing);
    }
  } catch(e) {}
})
