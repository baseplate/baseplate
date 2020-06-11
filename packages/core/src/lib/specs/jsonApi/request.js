const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  InvalidQueryParameterError,
} = require('../../errors')
const {default: FieldSet} = require('../../fieldSet')
const {default: QueryFilter} = require('../../queryFilter')
const JsonApiResponse = require('./response')
const JsonApiURL = require('./url')

class JsonApiRequest {
  constructor(req, context) {
    this.bodyFields = this.getEntryFieldsFromBody(req.body)
    this.context = context
    this.params = req.params

    const url = new JsonApiURL(req.url)
    const fields = url.getQueryParameter('fields') || {}
    const {number: pageNumber, size: pageSize} =
      url.getQueryParameter('page') || {}
    const includeMap = url.getQueryParameter('include')
    const sort = url.getQueryParameter('sort') || []
    const sortObject = sort.reduce((sortObject, expression) => {
      if (expression[0] === '-' || expression[0] === '+') {
        const sortValue = expression[0] === '-' ? -1 : 1

        return {
          ...sortObject,
          [expression.slice(1)]: sortValue,
        }
      }

      return {
        ...sortObject,
        [expression]: 1,
      }
    }, undefined)

    this.fields = fields
    this.filter = url.getQueryParameter('filter')
    this.includeMap = includeMap || {}
    this.pageNumber = pageNumber
    this.pageSize = pageSize
    this.url = url
    this.sort = sortObject
  }

  castRelationshipObject(object) {
    const result = {
      id: object.id,
      type: object.type,
    }

    return result
  }

  getEntryFieldsFromBody(body) {
    if (!body) {
      return {}
    }

    // (!) TO DO: Validate body format.
    const {attributes, relationships = {}} = body.data || {}
    const fields = {...attributes}

    Object.keys(relationships).forEach((fieldName) => {
      if (!relationships[fieldName]) {
        return null
      }

      const {data} = relationships[fieldName]

      fields[fieldName] = Array.isArray(data)
        ? data.map(this.castRelationshipObject)
        : this.castRelationshipObject(data)
    })

    return fields
  }

  async resolveReference({
    Access,
    entry,
    fieldName,
    includeMap,
    modelStore,
    referencesHash,
  }) {
    const fieldValue = entry.get(fieldName)

    if (!fieldValue || !entry.constructor.schema.isReferenceField(fieldName)) {
      return null
    }

    const isArrayValue = Array.isArray(fieldValue)
    const queue = (isArrayValue ? fieldValue : [fieldValue])
      .filter(Boolean)
      .map(async ({id, type}) => {
        const ReferencedModel = modelStore.get(type, {
          context: this.context,
        })

        if (!ReferencedModel) return null

        const access = await Access.getAccess({
          accessType: 'read',
          context: this.context,
          modelName: ReferencedModel.handle,
          user: this.context.user,
        })

        if (access.toObject() === false) {
          return null
        }

        const fieldSet = FieldSet.intersect(access.fields, this.fields[type])
        const referencedEntry = await ReferencedModel.findOneById({
          context: this.context,
          fieldSet,
          filter: access.filter,
          id,
        })

        if (includeMap && typeof includeMap === 'object') {
          const childReferenceQueue = Object.keys(includeMap).map(
            (childFieldName) => {
              return this.resolveReference({
                Access,
                entry: referencedEntry,
                fieldName: childFieldName,
                includeMap: includeMap[childFieldName],
                modelStore,
                referencesHash,
              })
            }
          )

          await Promise.all(childReferenceQueue)
        }

        return {
          fieldSet,
          entry: referencedEntry,
        }
      })
    const includedReferences = await Promise.all(queue)

    if (referencesHash) {
      includedReferences.filter(Boolean).forEach((reference) => {
        referencesHash[reference.entry.id] = reference
      })
    }

    const reference = isArrayValue ? includedReferences : includedReferences[0]

    return reference
  }

  async resolveReferences({entries, includeMap = this.includeMap, Model}) {
    const Access = Model.store.get('base_access')
    const referencesHash = {}
    const errors = {}
    const referenceQueue = entries.reduce((queue, entry) => {
      Object.keys(includeMap).forEach(async (fieldName) => {
        if (!entry.constructor.schema.isReferenceField(fieldName)) {
          errors[fieldName] =
            errors[fieldName] ||
            new InvalidQueryParameterError({
              name: 'include',
              value: fieldName,
            })

          return
        }

        queue.push(
          this.resolveReference({
            Access,
            entry,
            fieldName,
            includeMap: includeMap[fieldName],
            modelStore: Model.store,
            referencesHash,
          })
        )
      })

      return queue
    }, [])

    await Promise.all(referenceQueue)

    if (Object.keys(errors).length > 0) {
      const errorWrapper = new Error()

      errorWrapper.childErrors = Object.values(errors)

      throw errorWrapper
    }

    return referencesHash
  }
}

module.exports = JsonApiRequest
