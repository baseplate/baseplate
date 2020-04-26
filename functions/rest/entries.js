const {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../lib/errors')
const FieldSet = require('../../lib/fieldSet')
const JsonApiRequest = require('../../lib/specs/jsonApi/request')
const JsonApiResponse = require('../../lib/specs/jsonApi/response')
const modelFactory = require('../../lib/modelFactory')
const QueryFilter = require('../../lib/queryFilter')
const schemaStore = require('../../lib/schemaStore')

module.exports.get = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName, true)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema.name, schema)
    const access = await Model.getAccessForUser({
      accessType: 'read',
      user: req.user
    })

    if (access.isDenied()) {
      throw req.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const urlFieldSet = (req.url.getQueryParameter('fields', {
      isCSV: true
    }) || {})[schema.name]
    const fieldSet = FieldSet.intersect(access.fields, urlFieldSet)
    const filter = req.url.getQueryParameter('filter', {isJSON: true})
    const query = QueryFilter.parse(filter, '$').intersectWith(access.filter)
    const request = new JsonApiRequest(req)
    const {number: pageNumber, size: pageSize} =
      req.url.getQueryParameter('page', {
        isNumber: true
      }) || {}
    const {entries, totalPages} = await Model.find({
      pageNumber,
      pageSize,
      query
    })
    const includeMap = req.url.getQueryParameter('include', {isDotPath: true})

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

module.exports.post = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName, true)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema.name, schema)
    const access = await Model.getAccessForUser({
      accessType: 'create',
      user: req.user
    })

    if (access.isDenied()) {
      throw req.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const request = new JsonApiRequest(req)
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
