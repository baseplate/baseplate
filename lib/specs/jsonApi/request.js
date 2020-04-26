const {InvalidQueryParameterError} = require('../../errors')
const modelFactory = require('../../modelFactory')
const schemaStore = require('../../schemaStore')

class JsonApiRequest {
  constructor(req) {
    this.body = req.body || {}
    this.references = {}
    this.url = req.url
    this.user = req.user
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
    const {attributes, relationships = {}} = this.body.data
    const fields = {...attributes}

    Object.keys(relationships).forEach(fieldName => {
      const {data} = relationships[fieldName]

      fields[fieldName] = Array.isArray(data)
        ? data.map(this.castRelationshipObject)
        : this.castRelationshipObject(data)
    })

    return fields
  }

  async resolveReference({
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
        const fieldSet = fieldSets[type]
        const referencedSchema = schemaStore.get(type)

        if (!referencedSchema) return null

        const ReferencedModel = modelFactory(type, referencedSchema)
        const access = await ReferencedModel.getAccessForUser({
          accessType: 'read',
          user: this.user
        })

        const referencedEntry = await ReferencedModel.findOneById({
          fieldSet,
          id
        })

        if (includeMap && typeof includeMap === 'object') {
          const childReferenceQueue = Object.keys(includeMap).map(
            childFieldName => {
              return this.resolveReference({
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

        return referencedEntry
      })
    const includedReferences = await Promise.all(queue)

    if (referencesHash) {
      includedReferences.forEach(entry => {
        referencesHash[entry.id] = entry
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
