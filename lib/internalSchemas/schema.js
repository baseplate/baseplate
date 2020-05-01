const {EntryNotFoundError} = require('../errors')
const AccessValue = require('../accessValue')
const Model = require('../model')
const modelFactory = require('../modelFactory')
const Schema = require('../schema')
const schemaStore = require('../schemaStore')

class SchemaModel extends Model {
  static async find({fieldSet, filter}) {
    const sources = Array.from(schemaStore.models.values()).concat(
      Array.from(schemaStore.schemas.values())
    )
    const schemas = sources.map(async source => {
      const Model = modelFactory(source, {context: this.context})

      if (Model.schema.name.startsWith('_')) {
        return
      }

      const access = await Model.getAccessForUser({
        accessType: 'read',
        includePublicUser: true,
        user: this.context.user
      })

      if (access.isDenied()) {
        return
      }

      const fields = Object.keys(Model.schema.fields).reduce(
        (allowedFields, fieldName) => {
          if (access.fields && !access.fields.includes(fieldName)) {
            return allowedFields
          }

          return {
            ...allowedFields,
            [fieldName]: Model.schema.fields[fieldName]
          }
        },
        {}
      )

      return new this({
        _id: Model.schema.name,
        fields
      })
    })
    const entries = await Promise.all(schemas)

    return {entries: entries.filter(Boolean), totalPages: 1}
  }

  static findOneById({id}) {
    const schema = schemaStore.getSchema(id)

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

SchemaModel.schema = new Schema({
  fields: {
    fields: 'Mixed'
  },
  name: '_schema'
})

module.exports = SchemaModel
