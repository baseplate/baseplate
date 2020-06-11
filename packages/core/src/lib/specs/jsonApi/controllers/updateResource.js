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
      accessType: 'update',
      context,
      modelName: Model.handle,
      user: context.user,
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const jsonApiReq = new JsonApiRequest(req, context)
    const {id} = jsonApiReq.params
    const entry = await Model.updateOneById({
      id,
      update: jsonApiReq.bodyFields,
    })
    const references = await jsonApiReq.resolveReferences({
      entries: [entry],
      Model,
    })
    const jsonApiRes = new JsonApiResponse({
      entries: entry,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      res,
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
