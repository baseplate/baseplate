import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import * as tokenRoute from './userControllers/token'
import {AccessValue} from '../accessValue'
import {ForbiddenError} from '../errors'
import BaseModel, {
  AuthenticateParameters,
  FindOneByIdParameters,
} from '../model/base'

const TOKEN_EXPIRATION = 3600
const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

export default class Base$User extends BaseModel {
  static base$fields = {
    accessLevel: {
      type: String,
      default: 'user',
      enum: ['admin', 'user'],
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      set: (value: string) =>
        new Promise((resolve, reject) => {
          bcrypt.hash(value, 10, (err, hash) =>
            err ? reject(err) : resolve(hash)
          )
        }),
    },
  }

  static base$interfaces = {
    restCreateResource: true,
    restDeleteResource: true,
    restFindResource: true,
    restFindResources: true,
    restUpdateResource: true,
  }

  static base$routes = {
    '/base$users/token': tokenRoute,
  }

  static base$authenticate({access, accessType, user}: AuthenticateParameters) {
    if (user && accessType === 'read' && !user.isAdmin()) {
      return new AccessValue({
        filter: {
          _id: user.id,
        },
      })
    }

    return access
  }

  static findOneById(props: FindOneByIdParameters) {
    if (props.id !== 'me') {
      return super.findOneById(props)
    }

    const user = props.context.get('base$user')

    if (!user || !(user instanceof Base$User)) {
      throw new ForbiddenError()
    }

    return super.findOneById({
      ...props,
      authenticate: false,
      id: user.id,
    })
  }

  static async generateAccessToken(user: Base$User) {
    const data = {
      id: user.id,
      level: user.get('accessLevel'),
      model: (<typeof Base$User>user.constructor).base$handle,
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

  async toObject(options: object) {
    const object = await super.toObject(options)

    delete object.password

    return object
  }

  validatePassword(password: string) {
    return bcrypt.compare(password, this.get('password'))
  }
}
