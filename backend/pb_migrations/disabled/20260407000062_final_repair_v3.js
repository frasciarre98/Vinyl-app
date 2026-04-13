migrate((app) => {
  try {
    console.log(">> FINAL REPAIR - Clean Slate approach starting...");
    
    // 1. Delete the existing "vinyls" collection if it exists
    try {
        const existing = app.findCollectionByNameOrId("vinyls");
        if (existing) {
            console.log(">> Deleting existing 'vinyls' collection...");
            app.delete(existing);
        }
    } catch (e) {
        console.log(">> Collection did not exist or delete failed (expected if missing).");
    }

    // 2. Create the "vinyls" collection with the CLEAN 0.36.1 schema
    console.log(">> Creating fresh 'vinyls' collection...");
    const collection = new Collection({
        name: "vinyls",
        type: "base",
        fields: [
            { id: "v_title", name: "title", type: "text" },
            { id: "v_artist", name: "artist", type: "text" },
            { id: "v_year", name: "year", type: "text" },
            { id: "v_genre", name: "genre", type: "text" },
            { id: "v_label", name: "label", type: "text" },
            { id: "v_cat", name: "catalog_number", type: "text" },
            { id: "v_ed", name: "edition", type: "text" },
            { id: "v_cond", name: "condition", type: "text" },
            { id: "v_desc", name: "description", type: "text" },
            { id: "v_tracks", name: "tracks", type: "text" },
            { id: "v_notes", name: "notes", type: "text" },
            { id: "v_liner", name: "liner_notes", type: "text" },
            { id: "v_img", name: "image", type: "file" },
            { id: "v_val", name: "is_tracks_validated", type: "bool" },
            { id: "v_rat", name: "rating", type: "number" },
            { id: "v_lock", name: "is_price_locked", type: "bool" },
            { id: "v_price", name: "purchase_price", type: "text" },
            { id: "v_pyear", name: "purchase_year", type: "text" },
            { id: "v_locked", name: "locked_fields", type: "json" },
            { id: "v_orig", name: "original_filename", type: "text" }
        ],
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: ""
    });
    app.save(collection);
    console.log("✅ Collection created successfully.");

    // 3. Re-import the data
    const paths = [
        '/pb/pb_migrations/restore_data.json',
        './pb_migrations/restore_data.json',
        './backend/pb_migrations/restore_data.json'
    ];
    let jsonData = null;
    for (let i = 0; i < paths.length; i++) {
        try { jsonData = $os.readFile(paths[i]); if (jsonData) break; } catch (e) {}
    }

    if (jsonData) {
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
        console.log(">> Importing " + data.length + " records...");
        let count = 0;
        for (let i = 0; i < data.length; i++) {
            try {
                const item = data[i];
                const record = new Record(collection);
                const { image, ...safeData } = item;
                record.load(safeData);
                try { record.id = item.id; } catch (e) {}
                app.save(record);
                count++;
                if (count % 100 === 0) console.log(">> Imported " + count + " records...");
            } catch (err) {
                console.error(">> Failed to import record " + i + ": " + err);
            }
        }
        console.log("✅ Data import finished. Total: " + count);
    }

  } catch (err) {
    console.error(">> FINAL REPAIR CRITICAL FAILURE: " + err);
  }
}, (app) => {})
