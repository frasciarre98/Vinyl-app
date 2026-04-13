migrate((app) => {
    try {
        const collection = app.findCollectionByNameOrId("vinyls");
        if (!collection) return;

        console.log(">> DEEP METADATA FIX: Starting...");
        
        const paths = [
            '/pb/pb_migrations/restore_data.json',
            './pb_migrations/restore_data.json'
        ];
        let jsonData = null;
        for (let path of paths) {
            try { jsonData = $os.readFile(path); if (jsonData) break; } catch (e) {}
        }
        if (!jsonData) {
            console.log(">> DEEP METADATA FIX: restore_data.json not found.");
            return;
        }

        const dataStr = jsonData.string();
        const data = JSON.parse(dataStr);
        
        const fields = ["title", "artist", "year", "genre", "label", "catalog_number", "edition", "condition", "description", "tracks", "notes", "liner_notes", "image", "is_tracks_validated", "rating", "is_price_locked", "purchase_price", "purchase_year", "original_filename"];

        let count = 0;
        for (let item of data) {
            try {
                // Fuzzy match by Artist and Title since IDs might have changed
                const records = app.findRecordsByFilter("vinyls", "artist = {:artist} && title = {:title}", "-created", 1, 0, {
                    artist: item.artist,
                    title: item.title
                });
                
                if (records && records.length > 0) {
                    const record = records[0];
                    // 1. Set all standard fields
                    for (let f of fields) {
                        const val = item[f];
                        if (val !== undefined && val !== null && val !== "") {
                            record.set(f, val);
                        }
                    }
                    
                    // 2. Identify fields to LOCK
                    let locks = [];
                    const lockable = ["artist", "title", "label", "catalog_number", "edition", "purchase_price", "purchase_year", "notes"];
                    for (let f of lockable) {
                        const val = item[f];
                        if (val && val !== "" && val !== "Unknown" && val !== "N/A" && val !== "—") {
                            locks.push(f);
                        }
                    }
                    record.set("locked_fields", locks);
                    
                    app.save(record);
                    count++;
                }
            } catch (e) {
                // Silently skip if one record fails to match
            }
        }
        console.log("✅ DEEP METADATA FIX: Updated " + count + " records by name/title matching.");

    } catch (err) {
        console.error(">> DEEP METADATA FIX ERROR: " + err);
    }
}, (app) => {})
