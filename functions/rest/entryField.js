const {JsonApiRequest, JsonApiResponse} = require('../../lib/specs/jsonApi')
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

    const request = new JsonApiRequest(req)
    const referencesByFieldName = await request.resolveReferences({
      entries: [entry],
      includeMap: {[fieldName]: true}
    })
    const entries = referencesByFieldName[fieldName]
    const referencesHash = {}

    await request.resolveReferences({
      entries: Array.isArray(entries) ? entries : [entries],
      includeMap: req.url.getQueryParameter('include'),
      referencesHash
    })

    const response = new JsonApiResponse({
      entries,
      includedReferences: Object.values(referencesHash),
      includeTopLevelLinks: true,
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
