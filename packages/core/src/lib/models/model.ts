import {EntryNotFoundError} from '../errors'
import AccessClass from './access'
import Context from '../context'
import GenericModel from '../model/base'
import JsonApiEntry from '../specs/jsonApi/entry'

export default class Base$Model extends GenericModel {
  static fields = {
    label: String,
    fields: 'Mixed',
    handle: String,
    handlePlural: String,
  }

  static interfaces = {
    jsonApiFetchResource: true,
    jsonApiFetchResources: true,
  }

  static async find({context}: {context: Context}) {
    const schemas = this.base$modelStore.getAll().map(async (Model) => {
      if (Model.base$isInternal()) {
        return
      }

      const Access = <typeof AccessClass>this.base$modelStore.get('base$access')
      const access = await Access.getAccess({
        accessType: 'create',
        context,
        modelName: Model.base$handle,
        user: context.get('base$user'),
      })

      if (access.toObject() === false) {
        return
      }

      const fields = Object.keys(Model.base$schema.fields).reduce(
        (allowedFields, fieldName) => {
          if (access.fields && !access.fields.has(fieldName)) {
            return allowedFields
          }

          return {
            ...allowedFields,
            [fieldName]: Model.base$schema.fields[fieldName],
          }
        },
        {}
      )

      return new this({
        _id: Model.base$handle,
        label: Model.base$label,
        fields,
        handle: Model.base$handle,
        handlePlural: Model.base$handlePlural,
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
    const Model = this.base$modelStore.get(id)

    if (!Model) {
      throw new EntryNotFoundError({id})
    }

    return new this({_id: Model.base$handle, fields: Model.base$schema.fields})
  }

  base$jsonApiPostFormat(
    formattedEntry: JsonApiEntry,
    originalEntry: GenericModel
  ) {
    const Model = (<typeof GenericModel>(
      originalEntry.constructor
    )).base$modelStore.get(originalEntry.id)

    return {
      ...formattedEntry,
      links: {
        ...formattedEntry.links,
        root: `/${Model.base$handlePlural}`,
      },
    }
  }
}
