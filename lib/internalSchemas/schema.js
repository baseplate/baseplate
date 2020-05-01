const {EntryNotFoundError} = require('../errors')
const Model = require('../model')
const modelFactory = require('../modelFactory')
const Schema = require('../schema')
const schemaStore = require('../schemaStore')

class SchemaModel extends Model {
  static find({fieldSet, filter}) {
    const entriesFromSchemas = Array.from(schemaStore.schemas.values()).map(
      schema => {
        return new this({
          _id: schema.name,
          fields: schema.fields
        })
      }
    )
    const entriesFromModels = Array.from(schemaStore.models.values())
      .filter(model => !model.schema.name.startsWith('_'))
      .map(model => {
        return new this({
          _id: model.schema.name,
          fields: model.schema.fields
        })
      })
    const entries = entriesFromSchemas.concat(entriesFromModels)

    return {entries, totalPages: 1}
  }

  static findOneById({id}) {
    const schema = schemaStore.getSchema(id)

    if (!schema) {
      throw new EntryNotFoundError({id})
    }

    return new this({_id: schema.name, fields: schema.fields})
  }
}

SchemaModel.disableCreateResourceEndpoint = true

SchemaModel.schema = new Schema({
  fields: {
    fields: 'Mixed'
  },
  name: '_schema'
})

module.exports = SchemaModel
