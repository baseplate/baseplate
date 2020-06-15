const {
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
    const query = QueryFilter.parse(jsonApiReq.filter, '$').intersectWith(
      access.filter
    )
    const fieldSet = FieldSet.intersect(
      jsonApiReq.fields[Model.handle],
      access.fields
    )
    const {entries, pageSize, totalEntries, totalPages} = await Model.find({
      context,
      fieldSet,
      filter: query,
      pageNumber: jsonApiReq.pageNumber,
      pageSize: jsonApiReq.pageSize,
      sort: jsonApiReq.sort,
    })
    const references = await jsonApiReq.resolveReferences({entries, Model})
    const jsonApiRes = new JsonApiResponse({
      entries,
      fieldSet,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      pageSize,
      res,
      totalEntries,
      totalPages,
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
