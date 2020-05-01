const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelFactory = require('../../../modelFactory')
const schemaStore = require('../../../schemaStore')

module.exports.patch = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName, true)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema, {context})
    const access = await Model.getAccessForUser({
      accessType: 'update',
      user: context.user
    })

    if (access.isDenied()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const id = req.url.getPathParameter('id')
    const request = new JsonApiRequest(req, context)
    const update = await request.getEntryFieldsFromBody()
    const entry = await Model.update({id, update})

    await request.resolveReferences({
      entries: [entry],
      includeMap: req.url.getQueryParameter('include')
    })

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries: entry,
      includedReferences: Object.values(request.references),
      includeTopLevelLinks: true,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}