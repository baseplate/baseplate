const {EntryNotFoundError} = require('../errors')
const AccessValue = require('../accessValue')
const Model = require('../model')
const modelStore = require('../modelStore/')
const Schema = require('../schema')

class SchemaModel extends Model {
  static async find() {
    const models = Array.from(modelStore.models.values())
    const schemas = models.map(async Model => {
      if (Model.schema.name.startsWith('_')) {
        return
      }

      const ConnectedModel = modelStore.connect(Model, {context: this.context})
      const access = await ConnectedModel.getAccessForUser({
        accessType: 'read',
        includePublicUser: true,
        user: this.context.user
      })

      if (access.isDenied()) {
        return
      }

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

  static getAccessForUser() {
    const isSignedIn = Boolean(this.context.user)

    return AccessValue.parse(isSignedIn)
  }
}

SchemaModel.disableCreateResourceEndpoint = true
SchemaModel.disableDeleteResourceEndpoint = true
SchemaModel.disableFindResourceFieldEndpoint = true
SchemaModel.disableFindResourceFieldRelationshipEndpoint = true
SchemaModel.disableUpdateResourceEndpoint = true

SchemaModel.schema = new Schema({
  fields: {
    fields: 'Mixed'
  },
  name: '_schema'
})

module.exports = SchemaModel
