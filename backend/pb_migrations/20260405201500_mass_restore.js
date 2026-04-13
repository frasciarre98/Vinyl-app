migrate((app) => {
  let jsonData = null;
  const paths = [
    '/pb/pb_migrations/restore_data.json',
    './pb_migrations/restore_data.json',
    './backend/pb_migrations/restore_data.json'
  ];

  for (let i = 0; i < paths.length; i++) {
    try {
      jsonData = $os.readFile(paths[i]);
      if (jsonData) {
        console.log(">> Found restore data at: " + paths[i]);
        break;
      }
    } catch (e) {}
  }

  if (!jsonData) {
    console.log("❌ Restore data NOT found - skipping.");
    return;
  }
  
  let dataStr = "";
  try {
    // Try the most efficient way first if it's a Go type with .string()
    dataStr = jsonData.string().trim();
  } catch (e) {
    try {
      // Regular JS conversion for small arrays
      dataStr = String.fromCharCode.apply(null, jsonData).trim();
    } catch (e2) {
      // Manual loop for large arrays (failsafe)
      let s = "";
      for (let i = 0; i < jsonData.length; i++) {
        s += String.fromCharCode(jsonData[i]);
      }
      dataStr = s.trim();
    }
  }
  
  console.log(">> Data length: " + dataStr.length);
  const data = JSON.parse(dataStr);
  const collection = app.findCollectionByNameOrId('vinyls');
  
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    try {
      // Verifica se il record esiste già per evitare errori di ID duplicato
      try {
        const existing = app.findRecordById(collection.id, item.id);
        if (existing) {
          skipped++;
          continue;
        }
      } catch (e) {
        // Record non trovato, procediamo con l'inserimento
      }

      // In PocketBase 0.23+, we use core.Record or app.newRecord
      let record;
      try {
          record = new core.Record(collection);
      } catch (e) {
          try {
              record = new Record(collection);
          } catch (e2) {
              record = app.newRecord(collection);
          }
      }
      const { image, ...itemWithoutImage } = item;
      record.load(itemWithoutImage);
      if (image) {
          try {
              record.set("image", image);
          } catch (e3) {}
      }
      app.save(record);
      imported++;
    } catch (e) {
      console.log('Error importing record ' + item.id + ': ' + e);
    }
  }
  console.log("MASS RESTORE FINISHED: Imported " + imported + ", Skipped " + skipped);
}, (db) => {
  // rollback
})
