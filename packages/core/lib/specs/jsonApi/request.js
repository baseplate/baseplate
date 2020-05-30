const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  InvalidQueryParameterError
} = require('../../errors')
const FieldSet = require('../../fieldSet')
const JsonApiResponse = require('./response')
const JsonApiURL = require('./url')
const QueryFilter = require('../../queryFilter')

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
          [expression.slice(1)]: sortValue
        }
      }

      return {
        ...sortObject,
        [expression]: 1
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
      type: object.type
    }

    return result
  }

  async createResource({Model}) {
    const model = await Model.create(this.bodyFields)

    return JsonApiResponse.toObject({
      entries: model,
      statusCode: 201,
      url: this.url
    })
  }

  async deleteResource({Model}) {
    const id = this.params.id
    const {deleteCount} = await Model.delete({context: this.context, id})

    if (deleteCount === 0) {
      throw new EntryNotFoundError({id})
    }

    return JsonApiResponse.toObject({
      statusCode: 200,
      url: this.url
    })
  }

  async fetchResource({accessFields, accessFilter, Model}) {
    const fieldSet = FieldSet.intersect(accessFields, this.fields[Model.handle])
    const id = this.params.id
    const entry = await Model.findOneById({
      context: this.context,
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
    const fieldName = this.params.fieldName

    if (
      !Model.schema.fields[fieldName] ||
      (accessFields && !accessFields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.handle})
    }

    const id = this.params.id
    const entry = await Model.findOneById({context: this.context, id})

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
    const fieldName = this.params.fieldName

    if (
      !Model.schema.fields[fieldName] ||
      (accessFields && !accessFields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.handle})
    }

    const id = this.params.id
    const entry = await Model.findOneById({context: this.context, id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const fieldValue = entry.get(fieldName)
    const isReferenceArray = Array.isArray(fieldValue)
    const referenceArray = isReferenceArray ? fieldValue : [fieldValue]
    const referenceEntries = referenceArray.map(({id, type}) => {
      const ReferenceModel = Model.store.get(type)

      return new ReferenceModel({_id: id})
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
    const fieldSet = FieldSet.intersect(this.fields[Model.handle], accessFields)
    const {entries, totalPages} = await Model.find({
      context: this.context,
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
      .map(async ({id, type}) => {
        const ReferencedModel = modelStore.get(type, {
          context: this.context
        })

        if (!ReferencedModel) return null

        const access = await Access.getAccess({
          accessType: 'read',
          context: this.context,
          modelName: ReferencedModel.handle,
          user: this.context.user
        })

        if (access.toObject() === false) {
          return null
        }

        const fieldSet = FieldSet.intersect(access.fields, this.fields[type])
        const referencedEntry = await ReferencedModel.findOneById({
          context: this.context,
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
    const Access = Model.store.get('base_access')
    const referencesHash = {}
    const errors = {}
    const referenceQueue = entries.reduce((queue, entry) => {
      Object.keys(includeMap).forEach(async fieldName => {
        if (!entry.constructor.schema.isReferenceField(fieldName)) {
          errors[fieldName] =
            errors[fieldName] ||
            new InvalidQueryParameterError({
              name: 'include',
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
    const id = this.params.id
    const entry = await Model.update({
      context: this.context,
      id,
      update: this.bodyFields
    })
    const references = await this.resolveReferences({entries: [entry], Model})

    return JsonApiResponse.toObject({
      entries: entry,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      url: this.url
    })
  }
}

module.exports = JsonApiRequest
