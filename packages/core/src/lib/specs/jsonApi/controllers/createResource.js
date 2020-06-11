const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError,
} = require('../../../errors')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelStore = require('../../../modelStore/')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.params.modelName
    const Model = modelStore.getByPluralForm(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Access = modelStore.get('base_access')
    const access = await Access.getAccess({
      accessType: 'create',
      context,
      modelName: Model.handle,
      user: context.user,
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const jsonApiReq = new JsonApiRequest(req, context)
    const model = await Model.create(jsonApiReq.bodyFields)
    const jsonApiRes = new JsonApiResponse({
      entries: model,
      res,
      statusCode: 201,
      url: jsonApiReq.url,
    })

    jsonApiRes.end()
  } catch (errors) {
    const jsonApiRes = new JsonApiResponse({
      errors,
      res,
      url: req.url,
    })

    jsonApiRes.end()
  }
}
