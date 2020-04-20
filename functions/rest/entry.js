const {JsonApiRequest, JsonApiResponse} = require('../../lib/specs/jsonApi')
const {EntryNotFoundError, ModelNotFoundError} = require('../../lib/errors')
const getEventToken = require('../../lib/acl/getEventToken')
const modelFactory = require('../../lib/modelFactory')
const schemaStore = require('../../lib/schemaStore')
const validateAccess = require('../../lib/acl/validateAccess')

module.exports.delete = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(modelName, schema)
    const id = req.url.getPathParameter('id')
    const {deleteCount} = await Model.delete({id})

    if (deleteCount === 0) {
      throw new EntryNotFoundError({id})
    }

    const response = new JsonApiResponse({
      statusCode: 200,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  } catch (errors) {
    const response = new JsonApiResponse({
      errors,
      request: this,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  }
}

module.exports.get = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    // const access = await validateAccess({
    //   ...getEventToken(req),
    //   accessType: 'read',
    //   resource: `model:${modelName}`
    // })

    const Model = modelFactory(modelName, schema)
    const id = req.url.getPathParameter('id')
    const entry = await Model.findOneById({
      id
    })

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const request = new JsonApiRequest(req)
    const referencesHash = {}

    await request.resolveReferences({
      entries: [entry],
      includeMap: req.url.getQueryParameter('include', {
        isCSV: true,
        isDotPath: true
      }),
      referencesHash
    })

    const response = new JsonApiResponse({
      entries: entry,
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

module.exports.patch = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(modelName, schema)
    const id = req.url.getPathParameter('id')
    const request = new JsonApiRequest(req)
    const update = await request.getEntryFieldsFromBody()
    const entry = await Model.update({id, update})
    const referencesHash = {}

    await request.resolveReferences({
      entries: [entry],
      includeMap: req.url.getQueryParameter('include'),
      referencesHash
    })

    const response = new JsonApiResponse({
      entries: entry,
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
