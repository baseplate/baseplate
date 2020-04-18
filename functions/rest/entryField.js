const {JsonApiRequest, JsonApiResponse} = require('../../lib/specs/jsonApi')
const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ModelNotFoundError
} = require('../../lib/errors')

module.exports.get = async (req, res, {modelStore}) => {
  const request = new JsonApiRequest({
    methot: 'get',
    modelStore,
    url: req.url
  })

  try {
    const modelName = req.url.getPathParameter('modelName')
    const Model = modelStore.get(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const fieldName = req.url.getPathParameter('fieldName')

    if (!Model.schema.fields[fieldName]) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.name})
    }

    const id = req.url.getPathParameter('id')
    const entry = await Model.findOneById({id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const referencesByFieldName = await request.resolveReferences({
      entries: [entry],
      includeMap: {[fieldName]: true}
    })
    const entries = referencesByFieldName[fieldName]

    // Resolving references on the referenced document.
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
