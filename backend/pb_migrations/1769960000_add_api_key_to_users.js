migrate((app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_")

    collection.fields.add(new TextField({
        "name": "gemini_api_key",
        "required": false,
        "presentable": false,
        "system": false,
        "hidden": false,
        "pattern": ""
    }))

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_")

    collection.fields.removeByName("gemini_api_key")

    return app.save(collection)
})
