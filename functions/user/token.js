const {UnauthorizedError} = require('../../lib/errors')
const {validateObject} = require('../../packages/validator')
const generateAccessToken = require('../../lib/acl/generateAccessToken')
const JsonApiResponse = require('../../lib/specs/jsonApi/response')
const modelFactory = require('../../lib/modelFactory')
const QueryFilter = require('../../lib/queryFilter')
const Schema = require('../../lib/schema')
const UserSchema = require('../../lib/internalSchemas/user')

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

module.exports.post = async (req, res) => {
  try {
    const data = req.body

    validateObject({
      enforceRequiredFields: true,
      object: data,
      schema: endpointSchema.fields
    })

    const {username, password} = data
    const Model = modelFactory(UserSchema)
    const user = await Model.findOne({
      filter: QueryFilter.parse({username})
    })

    if (!user) {
      throw new UnauthorizedError()
    }

    const isAuthorized = await user.validatePassword(password)

    if (!isAuthorized) {
      throw new UnauthorizedError()
    }

    const {accessToken, expiration} = generateAccessToken({user})
    const responseBody = {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expiration
    }

    res.status(200).json(responseBody)
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors
    })

    res.status(statusCode).json(body)
  }
}
