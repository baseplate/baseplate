import {Validator} from '@baseplate/validator'

import {UnauthorizedError} from '../../errors'
import Context from '../../context'
import cookie from 'cookie'
import HttpRequest from '../../http/request'
import HttpResponse from '../../http/response'
import JsonApiRequest from '../../specs/jsonApi/request'
import JsonApiResponse from '../../specs/jsonApi/response'
import QueryFilter from '../../queryFilter'
import Schema from '../../schema'

const tokenEndpointSchema = new Schema({
  fields: {
    grant_type: {
      type: String,
      required: true,
      enum: ['password', 'refresh_token'],
    },
    username: {
      type: String,
      required: (entry: any) => entry.grant_type === 'password',
    },
    password: {
      type: String,
      required: (entry: any) => entry.grant_type === 'password',
    },
  },
  name: 'tokenEndpoint',
})

async function deleteFn(
  req: HttpRequest,
  res: HttpResponse,
  context: Context
): Promise<void> {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const RefreshTokenModel = this.store.get('base_refreshToken')

    if (req.headers.cookie) {
      const {refresh_token: refreshToken} = cookie.parse(req.headers.cookie)

      await RefreshTokenModel.deleteToken(refreshToken)
    }

    res.status(204).end()
  } catch (errors) {
    const jsonApiRes = new JsonApiResponse({
      errors,
      res,
      url: jsonApiReq.url,
    })

    jsonApiRes.end()
  }
}

async function post(req: HttpRequest, res: HttpResponse, context: Context) {
  const jsonApiReq = new JsonApiRequest(req, context)

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
      const {didReplace, token} = await RefreshTokenModel.generateAndReplace(
        user,
        refreshToken
      )
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
    const jsonApiRes = new JsonApiResponse({
      errors,
      res,
      url: jsonApiReq.url,
    })

    jsonApiRes.end()
  }
}

export {deleteFn as delete, post}