const {
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
const JsonApiResponse = require('../response')
const modelStore = require('../../../modelStore/')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const Model = modelStore.get(modelName, {context, isPlural: true})

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Access = modelStore.get('base_modelAccess', {context})
    const access = await Access.getAccess({
      accessType: 'delete',
      modelName: Model.schema.name,
      user: context.user
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const id = req.url.getPathParameter('id')
    const {deleteCount} = await Model.delete({id})

    if (deleteCount === 0) {
      throw new EntryNotFoundError({id})
    }

    const {body, statusCode} = await JsonApiResponse.toObject({
      statusCode: 200,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      request: this,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}
