import {Request, Response} from '../tests/utils/requestResponse'
import {seconds} from '../tests/utils/timer'

import Author from './models/Author'
import Book from './models/Book'
import Genre from './models/Genre'

export default (app: any, options: object) => {
  describe('Authentication', () => {
    beforeAll(async () => {
      app.initialize([Author, Book, Genre], options)

      const User = app.modelStore.get('base$user')

      await User.create(
        {
          accessLevel: 'admin',
          username: 'baseplate',
          password: 'baseplate',
        },
        {authenticate: false}
      )
    })

    afterAll(async () => {
      const User = app.modelStore.get('base$user')

      await User.base$db.disconnect()
    })

    test('Returns access and refresh tokens if the request contains a correct set of credentials', async () => {
      const req = new Request({
        body: {
          grant_type: 'password',
          username: 'baseplate',
          password: 'baseplate',
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res = new Response()

      app.routesRest.initialize()

      const {
        $body,
        contentType,
        headers,
        statusCode,
      } = await app.routesRest.handler(req, res)

      expect(typeof $body.access_token).toBe('string')
      expect(typeof $body.expires_in).toBe('number')
      expect($body.token_type).toBe('bearer')
      expect(contentType).toBe('application/json')
      expect(statusCode).toBe(200)
      expect(typeof headers['Set-Cookie']).toBe('string')
      expect(/^refresh_token=(.*)HttpOnly$/.test(headers['Set-Cookie'])).toBe(
        true
      )
    })

    test('Returns a new access and refresh tokens if the request contains a valid refresh token', async (done) => {
      const req1 = new Request({
        body: {
          grant_type: 'password',
          username: 'baseplate',
          password: 'baseplate',
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res1 = new Response()

      app.routesRest.initialize()

      const {$body: body1, headers: headers1} = await app.routesRest.handler(
        req1,
        res1
      )
      const [, refreshToken] = headers1['Set-Cookie'].match(
        /^refresh_token=([^;]*);(.*)HttpOnly$/
      )

      await seconds(1)

      const req2 = new Request({
        body: {
          grant_type: 'password',
          username: 'baseplate',
          password: 'baseplate',
        },
        method: 'post',
        refreshToken,
        url: '/base$users/token',
      })
      const res2 = new Response()

      const {
        $body: body2,
        contentType,
        headers: headers2,
        statusCode,
      } = await app.routesRest.handler(req2, res2)

      expect(body1.access_token).not.toBe(body2.access_token)
      expect(typeof body2.access_token).toBe('string')
      expect(typeof body2.expires_in).toBe('number')
      expect(body2.token_type).toBe('bearer')
      expect(contentType).toBe('application/json')
      expect(statusCode).toBe(200)
      expect(typeof headers2['Set-Cookie']).toBe('string')
      expect(/^refresh_token=(.*)HttpOnly$/.test(headers2['Set-Cookie'])).toBe(
        true
      )

      done()
    })

    test('Returns an error if the request contains an invalid set of credentials', async () => {
      const req = new Request({
        body: {
          grant_type: 'password',
          username: 'johndoe',
          password: 'unknown',
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res = new Response()

      app.routesRest.initialize()

      const {$body, contentType, statusCode} = await app.routesRest.handler(
        req,
        res
      )

      expect($body.errors).toBeInstanceOf(Array)
      expect(contentType).toBe('application/vnd.api+json')
      expect(statusCode).toBe(401)
    })

    test('Returns an error if the request contains an invalid grant type', async () => {
      const req = new Request({
        body: {
          grant_type: 'something',
          username: 'johndoe',
          password: 'unknown',
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res = new Response()

      app.routesRest.initialize()

      const {$body, contentType, statusCode} = await app.routesRest.handler(
        req,
        res
      )

      expect($body.errors).toBeInstanceOf(Array)
      expect($body.errors[0].status).toBe(400)
      expect($body.errors[0].source.pointer).toBe('/data/attributes/grant_type')
      expect(contentType).toBe('application/vnd.api+json')
      expect(statusCode).toBe(400)
    })
  })
}
