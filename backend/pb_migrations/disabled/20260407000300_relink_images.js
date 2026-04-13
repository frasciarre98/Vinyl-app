migrate((app) => {
    try {
        const collection = app.findCollectionByNameOrId("vinyls");
        if (!collection) return;

        console.log(">> RELINK IMAGES: Starting...");
        
        const paths = [
            '/pb/pb_migrations/restore_data.json',
            './pb_migrations/restore_data.json'
        ];
        let jsonData = null;
        for (let path of paths) {
            try { jsonData = $os.readFile(path); if (jsonData) break; } catch (e) {}
        }
        if (!jsonData) return;

        const dataStr = jsonData.string();
        const data = JSON.parse(dataStr);
        
        let count = 0;
        for (let item of data) {
            if (item.image) {
                try {
                    const record = app.findRecordById("vinyls", item.id);
                    if (record && !record.get("image")) {
                        record.set("image", item.image);
                        app.save(record);
                        count++;
                    }
                } catch (e) {}
            }
        }
        console.log("✅ RELINK IMAGES: Updated " + count + " records.");

    } catch (err) {
        console.error(">> RELINK IMAGES ERROR: " + err);
    }
}, (app) => {})
