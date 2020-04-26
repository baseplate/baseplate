const {ForbiddenError, UnauthorizedError} = require('../../lib/errors')
const JsonApiResponse = require('../../lib/specs/jsonApi/response')
const modelFactory = require('../../lib/modelFactory')
const QueryFilter = require('../../lib/queryFilter')
const UserSchema = require('../../lib/internalSchemas/user')

module.exports.get = async (req, res) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError()
    }

    if (!req.user.isAdmin()) {
      throw new ForbiddenError()
    }

    const Model = modelFactory('_user', UserSchema)
    const fieldSet = (req.url.getQueryParameter('fields', {
      isCSV: true
    }) || {})['_user']
    const filter = req.url.getQueryParameter('filter', {isJSON: true})
    const query = QueryFilter.parse(filter, '$')
    const {number: pageNumber, size: pageSize} =
      req.url.getQueryParameter('page', {
        isNumber: true
      }) || {}
    const {entries, totalPages} = await Model.find({
      pageNumber,
      pageSize,
      query
    })
    const {body, statusCode} = await JsonApiResponse.toObject({
      entries,
      fieldSet,
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
