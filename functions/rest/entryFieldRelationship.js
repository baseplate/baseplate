const {JsonApiResponse} = require('../../lib/specs/jsonApi')
const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ModelNotFoundError
} = require('../../lib/errors')
const modelFactory = require('../../lib/modelFactory')
const schemaStore = require('../../lib/schemaStore')

module.exports.get = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(modelName, schema)
    const fieldName = req.url.getPathParameter('fieldName')

    if (!Model.schema.fields[fieldName]) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.name})
    }

    const id = req.url.getPathParameter('id')
    const entry = await Model.findOneById({id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const fieldValue = entry.get(fieldName)
    const isReferenceArray = Array.isArray(fieldValue)
    const referenceArray = isReferenceArray ? fieldValue : [fieldValue]
    const referenceEntries = referenceArray.map(({_id, _type}) => {
      const referencedSchema = schemaStore.get(_type)
      const ReferenceModel = modelFactory(_type, referencedSchema)

      return new ReferenceModel({_id})
    })
    const response = new JsonApiResponse({
      includeTopLevelLinks: true,
      relationships: isReferenceArray ? referenceEntries : referenceEntries[0],
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  } catch (errors) {
    const response = new JsonApiResponse({
      errors,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  }
}
