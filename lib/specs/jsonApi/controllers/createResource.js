const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelFactory = require('../../../modelFactory')
const schemaStore = require('../../../schemaStore')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName, true)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema, {context})
    const access = await Model.getAccessForUser({
      accessType: 'create',
      user: context.user
    })

    if (access.isDenied()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const request = new JsonApiRequest(req, context)
    const entryFields = await request.getEntryFieldsFromBody()
    const model = await Model.create({entryFields})
    const {body, statusCode} = await JsonApiResponse.toObject({
      entries: model,
      statusCode: 201,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    console.log(errors)
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}
