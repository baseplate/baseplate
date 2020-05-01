const Model = require('../model')
const modelFactory = require('../modelFactory')
const Schema = require('../schema')
const schemaStore = require('../schemaStore')

class SchemaModel extends Model {
  static find({fieldSet, filter}) {
    const entriesFromSchemas = Array.from(schemaStore.schemas.values()).map(
      schema => {
        return new this({fields: schema.fields, name: schema.name})
      }
    )
    const entriesFromModels = Array.from(schemaStore.models.values())
      .filter(model => !model.schema.name.startsWith('_'))
      .map(model => {
        return new this(model.schema.fields)
      })
    const entries = entriesFromSchemas.concat(entriesFromModels)

    return {entries, totalPages: 1}
  }
}

SchemaModel.disableCreateResourceEndpoint = true

SchemaModel.schema = new Schema({
  fields: {
    fields: 'Mixed',
    name: String
  },
  name: '_schema'
})

module.exports = SchemaModel
