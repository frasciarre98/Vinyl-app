/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1326837967")

  // add field
  collection.fields.addAt(22, new Field({
    "hidden": false,
    "id": "json3409034069",
    "name": "locked_fields",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1326837967")

  // remove field
  collection.fields.removeById("json3409034069")

  return app.save(collection)
})
