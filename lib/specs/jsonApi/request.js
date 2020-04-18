const {InvalidQueryParameterError} = require('../../errors')

class JsonApiRequest {
  constructor({body, modelStore, url}) {
    this.body = body || {}
    this.modelStore = modelStore
    this.url = url
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

  async resolveReference({entry, fieldName, includeMap, referencesHash}) {
    const fieldValue = entry.get(fieldName)

    if (!fieldValue || !entry.constructor.schema.isReferenceField(fieldName)) {
      return null
    }

    const isArrayValue = Array.isArray(fieldValue)
    const queue = (isArrayValue ? fieldValue : [fieldValue])
      .filter(Boolean)
      .map(async ({_id: id, _type: type}) => {
        const ReferencedModel = this.modelStore.get(type)

        if (!ReferencedModel) return null

        const referencedEntry = await ReferencedModel.findOneById({id})

        if (includeMap && typeof includeMap === 'object') {
          const childReferenceQueue = Object.keys(includeMap).map(
            childFieldName => {
              return this.resolveReference({
                entry: referencedEntry,
                fieldName: childFieldName,
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

  async resolveReferences({entries, includeMap = {}, referencesHash}) {
    const errorsByIncludePath = {}
    const referencesByFieldName = {}
    const referenceQueue = entries.reduce((queue, entry) => {
      Object.keys(includeMap).forEach(async fieldName => {
        //console.log({entry, fieldName})
        if (!entry.constructor.schema.isReferenceField(fieldName)) {
          errorsByIncludePath[fieldName] =
            errorsByIncludePath[fieldName] ||
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
            includeMap: includeMap[fieldName],
            referencesHash
          }).then(fieldReference => {
            referencesByFieldName[fieldName] = fieldReference
          })
        )
      })

      return queue
    }, [])

    await Promise.all(referenceQueue)

    if (Object.keys(errorsByIncludePath).length > 0) {
      const errorWrapper = new Error()

      errorWrapper.childErrors = Object.values(errorsByIncludePath)

      throw errorWrapper
    }

    return referencesByFieldName
  }
}

module.exports = JsonApiRequest
