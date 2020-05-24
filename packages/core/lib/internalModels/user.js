const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const {ForbiddenError, UnauthorizedError} = require('../errors')
const {validateObject} = require('../../../../packages/validator')
const JsonApiResponse = require('../specs/jsonApi/response')
const Model = require('../model')
const QueryFilter = require('../queryFilter')
const Schema = require('../schema')

const TOKEN_EXPIRATION = 360000
const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

class BaseUser extends Model {
  static findOneById(props) {
    if (props.id !== 'me') {
      return super.findOneById(props)
    }

    const {user} = this.context

    if (!user || !(user instanceof BaseUser)) {
      throw new ForbiddenError()
    }

    return super.findOneById({
      ...props,
      id: user.id
    })
  }

  static async generateAccessToken({context, password, username}) {
    const user = await this.findOne({
      context,
      filter: QueryFilter.parse({username})
    })

    if (!user) {
      throw new UnauthorizedError()
    }

    const isAuthorized = await user.validatePassword(password)

    if (!isAuthorized) {
      throw new UnauthorizedError()
    }

    const data = {
      id: user.id,
      level: user.get('accessLevel'),
      model: user.constructor.handle
    }
    const accessToken = jwt.sign(
      {
        expiresIn: TOKEN_EXPIRATION,
        data
      },
      TOKEN_PRIVATE_KEY
    )

    return {accessToken, expiration: TOKEN_EXPIRATION}
  }

  isAdmin() {
    return this.get('accessLevel') === 'admin'
  }

  async toObject(options) {
    const object = await super.toObject(options)

    delete object.password

    return object
  }

  validatePassword(password) {
    return bcrypt.compare(password, this.get('password'))
  }
}

const tokenEndpointSchema = new Schema({
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

BaseUser.customRoutes = {
  '/BaseUsers/token': {
    async post(req, res, context) {
      try {
        const data = req.body

        validateObject({
          enforceRequiredFields: true,
          object: data,
          schema: tokenEndpointSchema.fields
        })

        const {username, password} = data
        const {accessToken, expiration} = await this.generateAccessToken({
          context,
          password,
          username
        })
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
  }
}

BaseUser.fields = {
  accessLevel: {
    type: String,
    default: 'user',
    enum: ['admin', 'user']
  },
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true,
    set: value =>
      new Promise((resolve, reject) => {
        bcrypt.hash(value, 10, (err, hash) =>
          err ? reject(err) : resolve(hash)
        )
      })
  }
}

BaseUser.handle = 'base_user'

BaseUser.interfaces = {
  jsonApiCreateResource: true,
  jsonApiDeleteResource: true,
  jsonApiFetchResource: true,
  jsonApiFetchResources: true,
  jsonApiUpdateResource: true
}

module.exports = BaseUser
