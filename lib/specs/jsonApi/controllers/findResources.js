const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
const FieldSet = require('../../../fieldSet')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelStore = require('../../../modelStore/')
const QueryFilter = require('../../../queryFilter')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const Model = modelStore.get(modelName, {context, isPlural: true})

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Access = modelStore.get('_modelAccess', {context})
    const access = await Access.getAccess({
      accessType: 'read',
      modelName: Model.schema.name,
      user: context.user
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const jsonApiReq = new JsonApiRequest({context, Model, req})
    const fieldSet = FieldSet.intersect(access.fields, jsonApiReq.fieldSet)
    const {filter, pageNumber, pageSize, sort} = jsonApiReq
    const query = QueryFilter.parse(filter, '$').intersectWith(access.filter)
    const {entries, totalPages} = await Model.find({
      fieldSet,
      filter: query,
      pageNumber,
      pageSize,
      sort
    })

    await jsonApiReq.resolveReferences(entries)

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries,
      fieldSet,
      includedReferences: Object.values(jsonApiReq.references),
      includeTopLevelLinks: true,
      totalPages,
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
