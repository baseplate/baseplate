const {JsonApiRequest, JsonApiResponse} = require('../../lib/specs/jsonApi')
const {ModelNotFoundError} = require('../../lib/errors')
const modelFactory = require('../../lib/modelFactory')
const getEventToken = require('../../lib/acl/getEventToken')
const QueryFilter = require('../../lib/queryFilter')
const schemaStore = require('../../lib/schemaStore')
const validateAccess = require('../../lib/acl/validateAccess')

module.exports.get = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(modelName, schema)
    const fieldSet = req.url.getQueryParameter('fields', {
      default: {},
      isCSV: true
    })[modelName]

    const filter = req.url.getQueryParameter('filter', {isJSON: true})
    const query = QueryFilter.parse(filter, '$')
    // const access = await validateAccess({
    //   ...getEventToken(req),
    //   accessType: 'read',
    //   resource: `model:${modelName}`
    // })

    // if (access.fields) {
    //   fieldSet = fieldSet
    //     ? fieldSet.filter(name => access.fields.includes(name))
    //     : Array.from(access.fields)
    // }

    // if (access.filter) {
    //   query.and(access.filter)
    // }

    const request = new JsonApiRequest(req)
    const {number: pageNumber, size: pageSize} = req.url.getQueryParameter(
      'page',
      {
        default: {},
        isNumber: true
      }
    )
    const {entries, totalPages} = await Model.find({
      pageNumber,
      pageSize,
      query
    })
    const referencesHash = {}
    const includeMap = req.url.getQueryParameter('include', {isDotPath: true})

    await request.resolveReferences({
      entries,
      includeMap,
      referencesHash
    })

    const response = new JsonApiResponse({
      entries,
      fieldSet,
      includedReferences: Object.values(referencesHash),
      includeTopLevelLinks: true,
      totalPages,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  } catch (errors) {
    const response = new JsonApiResponse({
      errors,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  }
}

module.exports.post = async (req, res) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(modelName, schema)
    const request = new JsonApiRequest(req)
    const entryFields = await request.getEntryFieldsFromBody()
    const model = await Model.create({entryFields})
    const response = new JsonApiResponse({
      entries: model,
      statusCode: 201,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  } catch (errors) {
    const response = new JsonApiResponse({
      errors,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  }
}
