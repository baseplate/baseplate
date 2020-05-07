const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  InvalidQueryParameterError
} = require('../../errors')
const FieldSet = require('../../fieldSet')
const JsonApiResponse = require('./response')
const QueryFilter = require('../../queryFilter')

class JsonApiRequest {
  constructor(req, context) {
    this.bodyFields = this.getEntryFieldsFromBody(req.body)
    this.context = context
    this.url = req.url

    const fields =
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

    this.fields = fields
    this.filter = req.url.getQueryParameter('filter', {isJSON: true})
    this.includeMap = includeMap || {}
    this.pageNumber = pageNumber
    this.pageSize = pageSize
    this.sort = sortObject
  }

  castRelationshipObject(object) {
    const result = {
      _id: object.id,
      _type: object.type
    }

    return result
  }

  async createResource({Model}) {
    const model = await Model.create({entryFields: this.bodyFields})

    return JsonApiResponse.toObject({
      entries: model,
      statusCode: 201,
      url: this.url
    })
  }

  async deleteResource({Model}) {
    const id = this.url.getPathParameter('id')
    const {deleteCount} = await Model.delete({id})

    if (deleteCount === 0) {
      throw new EntryNotFoundError({id})
    }

    return JsonApiResponse.toObject({
      statusCode: 200,
      url: this.url
    })
  }

  async fetchResource({accessFields, accessFilter, Model}) {
    const fieldSet = FieldSet.intersect(
      accessFields,
      this.fields[Model.schema.name]
    )
    const id = this.url.getPathParameter('id')
    const entry = await Model.findOneById({
      fieldSet,
      filter: accessFilter,
      id
    })

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const references = await this.resolveReferences({entries: [entry], Model})

    return JsonApiResponse.toObject({
      entries: entry,
      fieldSet,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      url: this.url
    })
  }

  async fetchResourceField({accessFields, Model}) {
    const fieldName = this.url.getPathParameter('fieldName')

    if (
      !Model.schema.fields[fieldName] ||
      (accessFields && !accessFields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.name})
    }

    const id = this.url.getPathParameter('id')
    const entry = await Model.findOneById({id})

    if (!entry || !entry.get(fieldName)) {
      throw new EntryNotFoundError({id})
    }

    const hasMultipleReferences = Array.isArray(entry.get(fieldName))
    const references = await this.resolveReferences({
      entries: [entry],
      includeMap: {
        [fieldName]: true
      },
      Model
    })
    const fieldValue = Object.values(references).map(({entry}) => entry)
    const childReferences = await this.resolveReferences({
      entries: fieldValue,
      Model
    })

    return JsonApiResponse.toObject({
      entries: hasMultipleReferences ? fieldValue : fieldValue[0],
      includedReferences: Object.values(childReferences),
      includeTopLevelLinks: true,
      url: this.url
    })
  }

  async fetchResourceFieldRelationship({accessFields, Model}) {
    const fieldName = this.url.getPathParameter('fieldName')

    if (
      !Model.schema.fields[fieldName] ||
      (accessFields && !accessFields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.name})
    }

    const id = this.url.getPathParameter('id')
    const entry = await Model.findOneById({id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const fieldValue = entry.get(fieldName)
    const isReferenceArray = Array.isArray(fieldValue)
    const referenceArray = isReferenceArray ? fieldValue : [fieldValue]
    const referenceEntries = referenceArray.map(({_id, _type}) => {
      const ReferenceModel = Model.store.get(_type, {context: this.context})

      return new ReferenceModel({_id})
    })

    return JsonApiResponse.toObject({
      includeTopLevelLinks: true,
      relationships: isReferenceArray ? referenceEntries : referenceEntries[0],
      url: this.url
    })
  }

  async fetchResources({accessFields, accessFilter, Model}) {
    const query = QueryFilter.parse(this.filter, '$').intersectWith(
      accessFilter
    )
    const fieldSet = FieldSet.intersect(
      this.fields[Model.schema.name],
      accessFields
    )
    const {entries, totalPages} = await Model.find({
      fieldSet,
      filter: query,
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      sort: this.sort
    })
    const references = await this.resolveReferences({entries, Model})

    return JsonApiResponse.toObject({
      entries,
      fieldSet,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      totalPages,
      url: this.url
    })
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
    modelStore,
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

        const fieldSet = FieldSet.intersect(access.fields, this.fields[type])
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
                modelStore,
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

  async resolveReferences({entries, includeMap = this.includeMap, Model}) {
    const Access = Model.store.get('base_modelAccess', {
      context: this.context
    })
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
            modelStore: Model.store,
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

    return referencesHash
  }

  async updateResource({Model}) {
    const id = this.url.getPathParameter('id')
    const entry = await Model.update({id, update: this.bodyFields})
    const references = await this.resolveReferences([entry])

    return JsonApiResponse.toObject({
      entries: entry,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      url: this.url
    })
  }
}

module.exports = JsonApiRequest
