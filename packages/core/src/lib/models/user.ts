import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import * as tokenRoute from './userControllers/token'
import {FindOneByIdParameters} from '../model/interface'
import {ForbiddenError} from '../errors'
import GenericModel from '../model/generic'

const TOKEN_EXPIRATION = 3600
const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

export default class BaseUser extends GenericModel {
  static customRoutes = {
    '/base_users/token': tokenRoute,
  }

  static fields = {
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
      set: (value: string) =>
        new Promise((resolve, reject) => {
          bcrypt.hash(value, 10, (err, hash) =>
            err ? reject(err) : resolve(hash)
          )
        }),
    },
  }

  static handle = 'base_user'

  static interfaces = {
    jsonApiCreateResource: true,
    jsonApiDeleteResource: true,
    jsonApiFetchResource: true,
    jsonApiFetchResources: true,
    jsonApiUpdateResource: true,
  }

  static findOneById(props: FindOneByIdParameters) {
    if (props.id !== 'me') {
      return super.findOneById(props)
    }

    const {user} = props.context

    if (!user || !(user instanceof BaseUser)) {
      throw new ForbiddenError()
    }

    return super.findOneById({
      ...props,
      id: user.id,
    })
  }

  static async generateAccessToken(user: BaseUser) {
    const data = {
      id: user.id,
      level: user.get('accessLevel'),
      model: (<typeof BaseUser>user.constructor).handle,
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
