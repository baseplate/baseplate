const {JsonApiResponse, JsonApiUrl} = require('../../../lib/specs/jsonApi')
const {ModelNotFoundError, UnauthorizedError} = require('../../../lib/errors')
const parseAuthorizationHeader = require('../../../lib/acl/parseAuthorizationHeader')
const ModelStore = require('../../../lib/modelStore')

const modelStore = new ModelStore()

module.exports.handler = async event => {
  let {id, modelName = '_user'} = event.pathParameters

  if (id === 'me') {
    const tokenUser = parseAuthorizationHeader(event.headers.Authorization)

    if (!tokenUser) {
      throw new UnauthorizedError()
    }

    id = tokenUser.id
    modelName = tokenUser.type
  }

  const Model = modelStore.get(modelName)

  if (!Model) {
    throw new ModelNotFoundError({name: modelName})
  }

  try {
    const user = await Model.findOneById({
      id
    })

    console.log({user})

    const response = new JsonApiResponse({
      entries: user,
      includeTopLevelLinks: true
    })

    return response.toObject()
  } catch (error) {
    const response = new JsonApiResponse({
      errors: [error]
    })

    return response.toObject()
  }
}
