const {
  JsonApiRequest,
  JsonApiResponse,
  JsonApiUrl
} = require('../../../lib/specs/jsonApi')
const {ModelNotFoundError} = require('../../../lib/errors')
const ModelStore = require('../../../lib/modelStore')

const modelStore = new ModelStore()

module.exports.handler = async event => {
  const url = new JsonApiUrl({
    path: event.path,
    pathParameters: event.pathParameters,
    queryParameters: event.queryStringParameters
  })

  try {
    const modelName = '_user' //url.getPathParameter('modelName')
    const Model = modelStore.get(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const request = new JsonApiRequest({body: event.body, Model, url})
    const entryFields = await request.getEntryFieldsFromBody()
    const model = await Model.create({entryFields})
    const response = new JsonApiResponse({
      entries: model,
      statusCode: 201,
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
