migrate((app) => {
    try {
        const collection = app.findCollectionByNameOrId("vinyls");
        if (!collection) {
            console.log(">> EMERGENCY RESTORE: 'vinyls' collection missing. Skipping.");
            return;
        }

        const totalRecords = app.countRecords("vinyls");
        if (totalRecords > 0) {
            console.log(">> EMERGENCY RESTORE: 'vinyls' collection already has " + totalRecords + " records. Skipping.");
            return;
        }

        console.log(">> EMERGENCY RESTORE: 'vinyls' collection empty. Starting force-import...");
        
        const paths = [
            '/pb/pb_migrations/restore_data.json',
            './pb_migrations/restore_data.json',
            './backend/pb_migrations/restore_data.json'
        ];
        let jsonData = null;
        for (let i = 0; i < paths.length; i++) {
            try { jsonData = $os.readFile(paths[i]); if (jsonData) break; } catch (e) {}
        }

        if (!jsonData) {
            console.log(">> EMERGENCY RESTORE: restore_data.json not found!");
            return;
        }

        let dataStr = "";
        try {
            dataStr = jsonData.string();
        } catch (e) {
            let s = "";
            for (let i = 0; i < jsonData.length; i++) {
                s += String.fromCharCode(jsonData[i]);
            }
            dataStr = s;
        }
        
        const data = JSON.parse(dataStr);
        console.log(">> EMERGENCY RESTORE: Importing " + data.length + " records...");
        
        let success = 0;
        for (let i = 0; i < data.length; i++) {
            try {
                const item = data[i];
                const record = new Record(collection);
                
                // Explicitly set ALL fields to ensure metadata like prices and notes are restored
                const fields = ["title", "artist", "year", "genre", "label", "catalog_number", "edition", "condition", "description", "tracks", "notes", "liner_notes", "image", "is_tracks_validated", "rating", "is_price_locked", "purchase_price", "purchase_year", "locked_fields", "original_filename"];
                
                for (let f of fields) {
                    if (item[f] !== undefined && item[f] !== null) {
                        record.set(f, item[f]);
                    }
                }
                
                // Force the original ID if possible
                try { record.id = item.id; } catch (e) {}
                
                app.save(record);
                success++;
                if (success % 100 === 0) console.log(">> EMERGENCY RESTORE: Imported " + success + " records...");
            } catch (err) {
                console.error(">> EMERGENCY RESTORE: Failed record " + i + ": " + err);
            }
        }
        console.log("✅ EMERGENCY RESTORE FINISHED. Total imported: " + success);

    } catch (err) {
        console.error(">> EMERGENCY RESTORE CRITICAL ERROR: " + err);
    }
}, (app) => {})
