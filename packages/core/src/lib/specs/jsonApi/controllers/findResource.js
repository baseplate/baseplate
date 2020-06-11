const {
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError,
} = require('../../../errors')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelStore = require('../../../modelStore/')
const {default: FieldSet} = require('../../../fieldSet')
const {default: QueryFilter} = require('../../../queryFilter')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.params.modelName
    const Model = modelStore.getByPluralForm(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Access = modelStore.get('base_access')
    const access = await Access.getAccess({
      accessType: 'read',
      context,
      modelName: Model.handle,
      user: context.user,
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const jsonApiReq = new JsonApiRequest(req, context)
    const fieldSet = FieldSet.intersect(
      access.fields,
      jsonApiReq.fields[Model.handle]
    )
    const {id} = jsonApiReq.params
    const entry = await Model.findOneById({
      context,
      fieldSet,
      filter: access.filter,
      id,
    })

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const references = await jsonApiReq.resolveReferences({
      entries: [entry],
      Model,
    })
    const jsonApiRes = new JsonApiResponse({
      entries: entry,
      fieldSet,
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
