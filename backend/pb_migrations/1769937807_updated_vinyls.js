/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1326837967")

  // add field
  collection.fields.addAt(20, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text503554547",
    "max": 0,
    "min": 0,
    "name": "purchase_price",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(21, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3409034068",
    "max": 0,
    "min": 0,
    "name": "purchase_year",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1326837967")

  // remove field
  collection.fields.removeById("text503554547")

  // remove field
  collection.fields.removeById("text3409034068")

  return app.save(collection)
})
