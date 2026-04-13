migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("vinyls");
    if (!collection) return;

    // Usiamo SQL grezzo per velocità e precisione sui campi di sistema del database SQLite
    // Inizializziamo tutti i record che hanno data nulla o vuota ad una data di base (1 Aprile 2026)
    const baseDate = "2026-04-01 10:00:00.000Z";
    
    // 1. Ripariamo i 'created' nulli o vuoti
    const resultCreated = app.db().newQuery(`
      UPDATE vinyls 
      SET created = '${baseDate}' 
      WHERE created IS NULL OR created = '' OR created = '0001-01-01 00:00:00.000Z'
    `).execute();

    // 2. Ripariamo gli 'updated' nulli o vuoti
    const resultUpdated = app.db().newQuery(`
      UPDATE vinyls 
      SET updated = '${baseDate}' 
      WHERE updated IS NULL OR updated = '' OR updated = '0001-01-01 00:00:00.000Z'
    `).execute();

    console.log("✅ TIMESTAMP REPAIR COMPLETED (V33)");
  } catch (err) {
    console.error("❌ Schema Repair Migration Failed:", err);
  }
}, (app) => {})
