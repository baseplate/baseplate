const {EntryNotFoundError} = require('../errors')
const Model = require('../model')

class base_model extends Model {
  static async find() {
    const schemas = this.store
      .getAll({context: this.context})
      .map(async Model => {
        if (Model.isBaseModel) {
          return
        }

        const Access = this.store.get('base_access', {
          context: this.context
        })
        const access = await Access.getAccess({
          accessType: 'create',
          modelName: Model.name,
          user: this.context.user
        })

        if (access.toObject() === false) {
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
          _id: Model.name,
          fields
        })
      })
    const entries = await Promise.all(schemas)

    return {entries: entries.filter(Boolean), totalPages: 1}
  }

  static findOneById({id}) {
    const Model = this.store.get(id)

    if (!Model) {
      throw new EntryNotFoundError({id})
    }

    return new this({_id: Model.name, fields: Model.schema.fields})
  }
}

base_model.restRoutes = {
  fetchResource: true,
  fetchResources: true
}

base_model.fields = {
  fields: 'Mixed'
}

module.exports = base_model
