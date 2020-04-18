const {JsonApiResponse, JsonApiUrl} = require('../../../lib/specs/jsonApi')
const ModelStore = require('../../../lib/modelStore')

const modelStore = new ModelStore()

module.exports.handler = async event => {
  const Model = modelStore.get('_user')
  const url = new JsonApiUrl({
    path: event.path,
    pathParameters: event.pathParameters,
    queryParameters: event.queryStringParameters
  })

  try {
    const {number: pageNumber, size: pageSize} = url.getQueryParameter('page')
    const {entries, totalPages} = await Model.find({pageNumber, pageSize})

    const response = new JsonApiResponse({
      entries,
      includeTopLevelLinks: true,
      totalPages,
      url
    })

    return response.toObject()
  } catch (errors) {
    const response = new JsonApiResponse({
      errors,
      url
    })

    return response.toObject()
  }
}
