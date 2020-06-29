import {EntryNotFoundError} from '../errors'
import AccessClass from './access'
import Context from '../context'
import GenericModel from '../model/generic'
import JsonApiEntry from '../specs/jsonApi/entry'

export default class BaseModel extends GenericModel {
  static fields = {
    label: String,
    fields: 'Mixed',
    handle: String,
    handlePlural: String,
  }

  static handle = 'base_model'

  static interfaces = {
    jsonApiFetchResource: true,
    jsonApiFetchResources: true,
  }

  static async find({context}: {context: Context}) {
    const schemas = this.store.getAll().map(async (Model) => {
      if (Model.isBaseModel) {
        return
      }

      const Access = <typeof AccessClass>this.store.get('base_access')
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
        label: Model.label,
        fields,
        handle: Model.handle,
        handlePlural: Model.handlePlural,
      })
    })
    const entries = (await Promise.all(schemas)).filter(Boolean)

    return {
      entries: entries,
      pageSize: entries.length,
      totalEntries: entries.length,
      totalPages: 1,
    }
  }

  static async findOneById({id}: {id: string}) {
    const Model = this.store.get(id)

    if (!Model) {
      throw new EntryNotFoundError({id})
    }

    return new this({_id: Model.handle, fields: Model.schema.fields})
  }

  base$jsonApiPostFormat(
    formattedEntry: JsonApiEntry,
    originalEntry: GenericModel
  ) {
    const Model = (<typeof GenericModel>originalEntry.constructor).store.get(
      originalEntry.id
    )

    return {
      ...formattedEntry,
      links: {
        ...formattedEntry.links,
        root: `/${Model.handlePlural}`,
      },
    }
  }
}
