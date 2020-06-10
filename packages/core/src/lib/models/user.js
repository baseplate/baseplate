const {Validator} = require('@baseplate/validator')
const bcrypt = require('bcryptjs')
const cookie = require('cookie')
const jwt = require('jsonwebtoken')

const {ForbiddenError, UnauthorizedError} = require('../errors')
const JsonApiResponse = require('../specs/jsonApi/response')
const {default: Model} = require('../model')
const {default: QueryFilter} = require('../queryFilter')
const {default: Schema} = require('../schema')

const TOKEN_EXPIRATION = 3600
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
      id: user.id,
    })
  }

  static async generateAccessToken(user) {
    const data = {
      id: user.id,
      level: user.get('accessLevel'),
      model: user.constructor.handle,
    }
    const accessToken = jwt.sign(
      {
        ttl: TOKEN_EXPIRATION,
        data,
      },
      TOKEN_PRIVATE_KEY
    )

    return {
      accessToken,
      ttl: TOKEN_EXPIRATION,
    }
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
      enum: ['password', 'refresh_token'],
    },
    username: {
      type: String,
      required: (entry) => entry.grant_type === 'password',
    },
    password: {
      type: String,
      required: (entry) => entry.grant_type === 'password',
    },
  },
})

BaseUser.customRoutes = {
  '/base_users/token': {
    async post(req, res, context) {
      try {
        const data = req.body

        Validator.validateObject({
          enforceRequiredFields: true,
          object: data,
          schema: tokenEndpointSchema.fields,
        })

        const RefreshTokenModel = this.store.get('base_refreshToken')
        const {username, grant_type: grantType, password} = data

        if (grantType === 'password') {
          const user = await this.findOne({
            context,
            filter: QueryFilter.parse({username}),
          })

          if (!user) {
            throw new UnauthorizedError()
          }

          const isAuthorized = await user.validatePassword(password)

          if (!isAuthorized) {
            throw new UnauthorizedError()
          }

          // Generating access token.
          const {accessToken, ttl} = await this.generateAccessToken(user)
          const responseBody = {
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: ttl,
          }

          // Generating refresh token.
          const {token} = await RefreshTokenModel.generateAndCreate(user)
          const refreshTokenCookie = cookie.serialize('refresh_token', token, {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7,
          })

          res.setHeader('Set-Cookie', refreshTokenCookie)

          return res.status(200).json(responseBody)
        }

        if (grantType === 'refresh_token') {
          if (!req.headers.cookie) {
            throw new UnauthorizedError()
          }

          const {refresh_token: refreshToken} = cookie.parse(req.headers.cookie)
          const {data: payload} = RefreshTokenModel.decode(refreshToken)

          // TO DO: Validate payload

          const UserModel = this.store.get(payload.modelName)
          const user = await UserModel.findOneById({context, id: payload.id})

          // Generating refresh token.
          const {
            didReplace,
            token,
          } = await RefreshTokenModel.generateAndReplace(user, refreshToken)
          const refreshTokenCookie = cookie.serialize('refresh_token', token, {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7,
          })

          if (!didReplace) {
            throw new UnauthorizedError()
          }

          res.setHeader('Set-Cookie', refreshTokenCookie)

          // Generating access token.
          const {accessToken, ttl} = await this.generateAccessToken(user)
          const responseBody = {
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: ttl,
          }

          return res.status(200).json(responseBody)
        }
      } catch (errors) {
        const {body, statusCode} = await JsonApiResponse.toObject({
          errors,
        })

        res.status(statusCode).json(body)
      }
    },
  },
}

BaseUser.fields = {
  accessLevel: {
    type: String,
    default: 'user',
    enum: ['admin', 'user'],
  },
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
    set: (value) =>
      new Promise((resolve, reject) => {
        bcrypt.hash(value, 10, (err, hash) =>
          err ? reject(err) : resolve(hash)
        )
      }),
  },
}

BaseUser.handle = 'base_user'

BaseUser.interfaces = {
  jsonApiCreateResource: true,
  jsonApiDeleteResource: true,
  jsonApiFetchResource: true,
  jsonApiFetchResources: true,
  jsonApiUpdateResource: true,
}

module.exports = BaseUser
