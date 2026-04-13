migrate((app) => {
  try {
    const existing = app.findCollectionByNameOrId('vinyls');
    if (existing) return;
  } catch (e) {
    const collection = new Collection({
      'name': 'vinyls',
      'type': 'base',
      'fields': [
        { 'id': 'text_title', 'name': 'title', 'type': 'text' },
        { 'id': 'text_artist', 'name': 'artist', 'type': 'text' },
        { 'id': 'text_year', 'name': 'year', 'type': 'text' },
        { 'id': 'text_genre', 'name': 'genre', 'type': 'text' },
        { 'id': 'text_label', 'name': 'label', 'type': 'text' },
        { 'id': 'text_cat', 'name': 'catalog_number', 'type': 'text' },
        { 'id': 'text_ed', 'name': 'edition', 'type': 'text' },
        { 'id': 'text_cond', 'name': 'condition', 'type': 'text' },
        { 'id': 'text_desc', 'name': 'description', 'type': 'text' },
        { 'id': 'text_tracks', 'name': 'tracks', 'type': 'text' },
        { 'id': 'text_notes', 'name': 'notes', 'type': 'text' },
        { 'id': 'text_liner', 'name': 'liner_notes', 'type': 'text' },
        { 'id': 'file_img', 'name': 'image', 'type': 'file' },
        { 'id': 'bool_val', 'name': 'is_tracks_validated', 'type': 'bool' },
        { 'id': 'num_rat', 'name': 'rating', 'type': 'number' },
        { 'id': 'bool_lock', 'name': 'is_price_locked', 'type': 'bool' },
        { 'id': 'text_price', 'name': 'purchase_price', 'type': 'text' },
        { 'id': 'text_pyear', 'name': 'purchase_year', 'type': 'text' },
        { 'id': 'json_locked', 'name': 'locked_fields', 'type': 'json' },
        { 'id': 'text_orig', 'name': 'original_filename', 'type': 'text' }
      ]
    });
    app.save(collection);
  }
}, (app) => {})
