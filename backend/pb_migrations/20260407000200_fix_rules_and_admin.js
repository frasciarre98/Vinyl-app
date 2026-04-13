migrate((app) => {
    try {
        const collection = app.findCollectionByNameOrId("vinyls");
        if (collection) {
            console.log(">> FIXING RULES: Making 'vinyls' public...");
            collection.listRule = ""; 
            collection.viewRule = "";
            app.save(collection);
            console.log("✅ 'vinyls' is now public.");
        }
    } catch (err) {
        console.error(">> RULE FIX ERROR: " + err);
    }
}, (app) => {})
