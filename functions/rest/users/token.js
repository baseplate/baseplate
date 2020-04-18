const {UnauthorizedError} = require('../../../lib/errors')
const generateAccessToken = require('../../../lib/acl/generateAccessToken')
const {
  GenericJsonRequest,
  GenericJsonResponse
} = require('../../../lib/specs/genericJson')
const {validateObject} = require('../../../packages/validator')
const ModelStore = require('../../../lib/modelStore')
const QueryFilter = require('../../../lib/queryFilter')
const Schema = require('../../../lib/schema')

const modelStore = new ModelStore()

const endpointSchema = new Schema({
  fields: {
    grant_type: {
      type: String,
      required: true,
      enum: ['password']
    },
    username: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    }
  }
})

module.exports.post = async event => {
  try {
    const request = new GenericJsonRequest({body: event.body})
    const data = request.getBody()

    validateObject({
      enforceRequiredFields: true,
      object: data,
      schema: endpointSchema.fields
    })

    const {email, password} = data
    const Model = modelStore.get('_user')
    const user = await Model.findOne({
      query: QueryFilter.parse({email})
    })

    if (!user) {
      throw new UnauthorizedError()
    }

    const isAuthorized = await user.validatePassword(password)

    if (!isAuthorized) {
      throw new UnauthorizedError()
    }

    const {accessToken, expiration} = generateAccessToken({user})
    const response = new GenericJsonResponse({
      data: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: expiration
      }
    })

    return response.toObject()
  } catch (errors) {
    const response = new GenericJsonResponse({
      errors
    })

    return response.toObject()
  }
}
