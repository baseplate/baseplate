import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import * as tokenRoute from './userControllers/token'
import {AccessValue} from '../accessValue'
import {ForbiddenError} from '../errors'
import BaseModel, {AuthenticateParameters} from '../model/base'
import Context from '../context'
import HttpRequest from '../http/request'
import HttpResponse from '../http/response'
import JsonApiEntry from '../specs/jsonApi/entry'
import JsonApiRequest from '../specs/jsonApi/request'
import JsonApiResponse from '../specs/jsonApi/response'
import QueryFilter from '../queryFilter/'

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
    '/base$users/me': {
      get: Base$User.findAuthenticatedUser,
    },
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

  static async findAuthenticatedUser(
    req: HttpRequest,
    res: HttpResponse,
    context: Context
  ) {
    const jsonApiReq = new JsonApiRequest(req, context)

    try {
      const user = context.get('base$user')

      if (!user || !(user instanceof Base$User)) {
        throw new ForbiddenError()
      }

      const entry = await super.findOne({
        authenticate: false,
        context,
        filter: new QueryFilter({_id: user.id}),
      })

      const jsonApiReq = new JsonApiRequest(req, context)
      const jsonApiRes = new JsonApiResponse({
        entries: entry,
        res,
        url: jsonApiReq.url,
      })

      return jsonApiRes.end()
    } catch (errors) {
      const jsonApiRes = new JsonApiResponse({
        errors,
        res,
        url: jsonApiReq.url,
      })

      return jsonApiRes.end()
    }
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

  base$jsonApiFormat(formattedEntry: JsonApiEntry) {
    formattedEntry.attributes.password = undefined

    return formattedEntry
  }

  isAdmin() {
    return this.get('accessLevel') === 'admin'
  }

  validatePassword(password: string) {
    return bcrypt.compare(password, this.get('password'))
  }
}
