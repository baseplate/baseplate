const {EntryNotFoundError} = require('../errors')
const AccessValue = require('../accessValue')
const BaseModel = require('../model')
const modelStore = require('../modelStore')
const Schema = require('../schema')

class Model extends BaseModel {
  static async find() {
    const models = Array.from(modelStore.models.values())
    const schemas = models.map(async Model => {
      if (Model.schema.name.startsWith('base_')) {
        return
      }

      const Access = modelStore.get('base_modelAccess', {context: this.context})
      const access = await Access.getAccess({
        accessType: 'create',
        modelName: Model.schema.name,
        user: this.context.user
      })

      if (access.toObject() === false) {
        return
      }

      const ConnectedModel = modelStore.get(Model.schema.name, {
        context: this.context
      })
      const {schema} = ConnectedModel
      const fields = Object.keys(schema.fields).reduce(
        (allowedFields, fieldName) => {
          if (access.fields && !access.fields.includes(fieldName)) {
            return allowedFields
          }

          return {
            ...allowedFields,
            [fieldName]: schema.fields[fieldName]
          }
        },
        {}
      )

      return new this({
        _id: schema.name,
        fields
      })
    })
    const entries = await Promise.all(schemas)

    return {entries: entries.filter(Boolean), totalPages: 1}
  }

  static findOneById({id}) {
    const schema = modelStore.getSchema(id)

    if (!schema) {
      throw new EntryNotFoundError({id})
    }

    return new this({_id: schema.name, fields: schema.fields})
  }
}

Model.disableCreateResourceEndpoint = true
Model.disableDeleteResourceEndpoint = true
Model.disableFindResourceFieldEndpoint = true
Model.disableFindResourceFieldRelationshipEndpoint = true
Model.disableUpdateResourceEndpoint = true

Model.schema = new Schema({
  fields: {
    fields: 'Mixed'
  },
  name: 'base_model'
})

module.exports = Model
