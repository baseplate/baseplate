const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const {ForbiddenError, UnauthorizedError} = require('../errors')
const {validateObject} = require('../../packages/validator')
const JsonApiResponse = require('../specs/jsonApi/response')
const Model = require('../model')
const QueryFilter = require('../queryFilter')
const Schema = require('../schema')

const TOKEN_EXPIRATION = 360000
const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

class UserModel extends Model {
  static findOneById(props) {
    if (props.id !== 'me') {
      return super.findOneById(props)
    }

    const {user} = this.context

    if (!user || !(user instanceof UserModel)) {
      throw new ForbiddenError()
    }

    return super.findOneById({
      ...props,
      id: user.id
    })
  }

  static async generateAccessToken({username, password}) {
    const user = await this.findOne({
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
      model: user.constructor.name
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

UserModel.customRoutes = {
  '/token': {
    async post(req, res) {
      try {
        const data = req.body

        validateObject({
          enforceRequiredFields: true,
          object: data,
          schema: tokenEndpointSchema.fields
        })

        const {username, password} = data
        const {accessToken, expiration} = await this.generateAccessToken({
          username,
          password
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

UserModel.schema = new Schema({
  fields: {
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
  },
  name: '_user'
})

module.exports = UserModel
