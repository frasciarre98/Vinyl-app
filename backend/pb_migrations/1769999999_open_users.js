migrate((app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_")

    collection.listRule = ""
    collection.viewRule = ""

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_")

    collection.listRule = "id = @request.auth.id"
    collection.viewRule = "id = @request.auth.id"

    return app.save(collection)
})
