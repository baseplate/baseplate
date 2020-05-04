const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelStore = require('../../../modelStore/')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const Model = modelStore.get(modelName, {context, isPlural: true})

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const access = await Model.getAccessForUser({
      accessType: 'create',
      user: context.user
    })

    if (access.toObject() === false) {
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
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}
