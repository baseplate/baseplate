const {InvalidQueryParameterError} = require('../../errors')
const FieldSet = require('../../fieldSet')
const modelStore = require('../../modelStore/')

class JsonApiRequest {
  constructor({context, Model, req}) {
    this.bodyFields = this.getEntryFieldsFromBody(req.body)
    this.context = context
    this.references = {}
    this.url = req.url

    const urlFields =
      req.url.getQueryParameter('fields', {
        isCSV: true
      }) || {}
    const {number: pageNumber, size: pageSize} =
      req.url.getQueryParameter('page', {
        isNumber: true
      }) || {}
    const includeMap = req.url.getQueryParameter('include', {
      isCSV: true,
      isDotPath: true
    })
    const sort =
      req.url.getQueryParameter('sort', {
        isCSV: true
      }) || []
    const sortObject = sort.reduce((sortObject, expression) => {
      if (expression[0] === '-' || expression[0] === '+') {
        const sortValue = expression[0] === '-' ? -1 : 1

        return {
          ...sortObject,
          [expression.slice(1)]: sortValue
        }
      }

      return {
        ...sortObject,
        [expression]: 1
      }
    }, undefined)

    this.fieldSet = urlFields[Model.schema.name]
    this.filter = req.url.getQueryParameter('filter', {isJSON: true})
    this.includeMap = includeMap || {}
    this.pageNumber = pageNumber
    this.pageSize = pageSize
    this.sort = sortObject
    this.urlFields = urlFields
  }

  castRelationshipObject(object) {
    const result = {
      _id: object.id,
      _type: object.type
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

    Object.keys(relationships).forEach(fieldName => {
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
    referencesHash
  }) {
    const fieldValue = entry.get(fieldName)

    if (!fieldValue || !entry.constructor.schema.isReferenceField(fieldName)) {
      return null
    }

    const isArrayValue = Array.isArray(fieldValue)
    const queue = (isArrayValue ? fieldValue : [fieldValue])
      .filter(Boolean)
      .map(async ({_id: id, _type: type}) => {
        const ReferencedModel = modelStore.get(type, {
          context: this.context
        })

        if (!ReferencedModel) return null

        const access = await Access.getAccess({
          accessType: 'read',
          modelName: ReferencedModel.name,
          user: this.context.user
        })

        if (access.toObject() === false) {
          return null
        }

        const fieldSet = FieldSet.intersect(access.fields, this.urlFields[type])
        const referencedEntry = await ReferencedModel.findOneById({
          fieldSet,
          filter: access.filter,
          id
        })

        if (includeMap && typeof includeMap === 'object') {
          const childReferenceQueue = Object.keys(includeMap).map(
            childFieldName => {
              return this.resolveReference({
                Access,
                entry: referencedEntry,
                fieldName: childFieldName,
                includeMap: includeMap[childFieldName],
                referencesHash
              })
            }
          )

          await Promise.all(childReferenceQueue)
        }

        return {
          fieldSet,
          entry: referencedEntry
        }
      })
    const includedReferences = await Promise.all(queue)

    if (referencesHash) {
      includedReferences.filter(Boolean).forEach(reference => {
        referencesHash[reference.entry.id] = reference
      })
    }

    const reference = isArrayValue ? includedReferences : includedReferences[0]

    return reference
  }

  async resolveReferences(entries, includeMap = this.includeMap) {
    const Access = modelStore.get('base_modelAccess', {context: this.context})
    const referencesHash = {}
    const errors = {}
    const referenceQueue = entries.reduce((queue, entry) => {
      Object.keys(includeMap).forEach(async fieldName => {
        if (!entry.constructor.schema.isReferenceField(fieldName)) {
          errors[fieldName] =
            errors[fieldName] ||
            new InvalidQueryParameterError({
              parameterName: 'include',
              value: fieldName
            })

          return
        }

        queue.push(
          this.resolveReference({
            Access,
            entry,
            fieldName,
            includeMap: includeMap[fieldName],
            referencesHash
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

    this.references = referencesHash
  }
}

module.exports = JsonApiRequest
