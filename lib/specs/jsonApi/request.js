const {InvalidQueryParameterError} = require('../../errors')
const FieldSet = require('../../fieldSet')
const modelStore = require('../../modelStore/')

class JsonApiRequest {
  constructor(req, context) {
    this.body = req.body || {}
    this.context = context
    this.modelCache = req.modelCache
    this.references = {}
    this.url = req.url
  }

  castRelationshipObject(object) {
    const result = {
      _id: object.id,
      _type: object.type
    }

    return result
  }

  getEntryFieldsFromBody() {
    // (!) TO DO: Validate body format.
    const {attributes, relationships = {}} = this.body.data || {}
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
    fieldSets = {},
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

        const fieldSet = FieldSet.intersect(access.fields, fieldSets[type])
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
                fieldSets,
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

  async resolveReferences({
    entries,
    fieldSets,
    includeMap = {},
    referencesHash = {}
  }) {
    const Access = modelStore.get('_modelAccess', {context: this.context})
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
            fieldSets,
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
