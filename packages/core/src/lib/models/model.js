const {EntryNotFoundError} = require('../errors')
const {default: Model} = require('../model')

class BaseModel extends Model {
  static async find({context}) {
    const schemas = this.store.getAll().map(async (Model) => {
      if (Model.isBaseModel) {
        return
      }

      const Access = this.store.get('base_access')
      const access = await Access.getAccess({
        accessType: 'create',
        context,
        modelName: Model.handle,
        user: context.user,
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
            [fieldName]: Model.schema.fields[fieldName],
          }
        },
        {}
      )

      return new this({
        _id: Model.handle,
        fields,
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

    return new this({_id: Model.handle, fields: Model.schema.fields})
  }

  $__jsonApiPostFormat(formattedEntry, originalEntry) {
    const Model = originalEntry.constructor.store.get(originalEntry.id)

    return {
      ...formattedEntry,
      links: {
        ...formattedEntry.links,
        root: `/${Model.handlePlural}`,
      },
    }
  }
}

BaseModel.fields = {
  fields: 'Mixed',
}

BaseModel.handle = 'base_model'

BaseModel.interfaces = {
  jsonApiFetchResource: true,
  jsonApiFetchResources: true,
}

module.exports = BaseModel
