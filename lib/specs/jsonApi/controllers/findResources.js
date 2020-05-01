const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
const FieldSet = require('../../../fieldSet')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelFactory = require('../../../modelFactory')
const QueryFilter = require('../../../queryFilter')
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
      accessType: 'read',
      user: context.user
    })

    if (access.isDenied()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const urlFieldSet = (req.url.getQueryParameter('fields', {
      isCSV: true
    }) || {})[Model.schema.name]
    const fieldSet = FieldSet.intersect(access.fields, urlFieldSet)
    const filter = req.url.getQueryParameter('filter', {isJSON: true})
    const query = QueryFilter.parse(filter, '$').intersectWith(access.filter)
    const request = new JsonApiRequest(req, context)
    const {number: pageNumber, size: pageSize} =
      req.url.getQueryParameter('page', {
        isNumber: true
      }) || {}
    const {entries, totalPages} = await Model.find({
      fieldSet,
      filter: query,
      pageNumber,
      pageSize
    })
    const includeMap = req.url.getQueryParameter('include', {
      isCSV: true,
      isDotPath: true
    })

    await request.resolveReferences({
      entries,
      includeMap
    })

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries,
      fieldSet,
      includedReferences: Object.values(request.references),
      includeTopLevelLinks: true,
      totalPages,
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
