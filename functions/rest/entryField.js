const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../lib/errors')
const JsonApiRequest = require('../../lib/specs/jsonApi/request')
const JsonApiResponse = require('../../lib/specs/jsonApi/response')
const modelFactory = require('../../lib/modelFactory')
const schemaStore = require('../../lib/schemaStore')

module.exports.get = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema, {context})
    const access = await Model.getAccessForUser({
      accessType: 'read',
      user: context.user
    })

    if (access.isDenied()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const fieldName = req.url.getPathParameter('fieldName')

    if (
      !Model.schema.fields[fieldName] ||
      (access.fields && !access.fields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.name})
    }

    const id = req.url.getPathParameter('id')
    const entry = await Model.findOneById({id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const request = new JsonApiRequest(req)

    await request.resolveReferences({
      entries: [entry],
      includeMap: {[fieldName]: true}
    })

    const entries = request.references[fieldName]

    await request.resolveReferences({
      entries: Array.isArray(entries) ? entries : [entries],
      includeMap: req.url.getQueryParameter('include')
    })

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries,
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
