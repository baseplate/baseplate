const {EntryNotFoundError} = require('../errors')
const BaseModel = require('../model')
const Schema = require('../schema')

class Model extends BaseModel {
  static async find() {
    const models = Array.from(this.store.models.values())
    const schemas = models.map(async Model => {
      if (Model.schema.name.startsWith('base_')) {
        return
      }

      const Access = this.store.get('base_modelAccess', {context: this.context})
      const access = await Access.getAccess({
        accessType: 'create',
        modelName: Model.schema.name,
        user: this.context.user
      })

      if (access.toObject() === false) {
        return
      }

      const ConnectedModel = this.store.get(Model.schema.name, {
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
    const schema = this.store.getSchema(id)

    if (!schema) {
      throw new EntryNotFoundError({id})
    }

    return new this({_id: schema.name, fields: schema.fields})
  }
}

Model.restRoutes = {
  fetchResource: true,
  fetchResources: true
}

Model.schema = new Schema({
  fields: {
    fields: 'Mixed'
  },
  name: 'base_model'
})

module.exports = Model
