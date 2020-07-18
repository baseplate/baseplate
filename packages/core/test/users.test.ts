import {
  App,
  forEachApp,
  getAccessToken,
  Request,
  Response,
} from '../../../test/utils'

import Author from '../../../test/models/Author'
import Book from '../../../test/models/Book'
import Genre from '../../../test/models/Genre'
import {createLogger} from 'winston'

forEachApp([Author, Book, Genre], (app: App) => {
  describe('User Management', () => {
    beforeAll(async () => {
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

    test('Allows an administrator to create a new user', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate',
        password: 'baseplate',
      })
      const newUser = {
        username: 'a-new-user',
        password: 'super-secret',
      }
      const req1 = new Request({
        body: {
          grant_type: 'password',
          ...newUser,
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(401)
      expect(res1.$body.errors).toBeInstanceOf(Array)

      const req2 = new Request({
        accessToken,
        body: {
          data: {
            type: 'base$user',
            attributes: {
              accessLevel: 'user',
              ...newUser,
            },
          },
        },
        contentType: 'jsonApi',
        method: 'post',
        url: '/base$users',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(201)
      expect(res2.$body.data.length).toBe(1)
      expect(res2.$body.data[0].type).toBe('base$user')
      expect(typeof res2.$body.data[0].id).toBe('string')
      expect(res2.$body.data[0].attributes.accessLevel).toBe('user')
      expect(res2.$body.data[0].attributes.username).toBe(newUser.username)
      expect(res2.$body.data[0].attributes.password).not.toBeDefined()

      const req3 = new Request({
        body: {
          grant_type: 'password',
          ...newUser,
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(typeof res3.$body.access_token).toBe('string')
      expect(typeof res3.$body.expires_in).toBe('number')
      expect(res3.$body.token_type).toBe('bearer')
      expect(res3.contentType).toBe('application/json')
      expect(res3.statusCode).toBe(200)
      expect(typeof res3.headers['Set-Cookie']).toBe('string')
      expect(
        /^refresh_token=(.*)HttpOnly$/.test(res3.headers['Set-Cookie'])
      ).toBe(true)
    })

    test('Returs the authenticated user', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/base$users/me',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.$body.data.type).toBe('base$user')
      expect(typeof res.$body.data.id).toBe('string')
      expect(res.$body.data.attributes.accessLevel).toBe('admin')
      expect(res.$body.data.attributes.username).toBe('baseplate')
      expect(res.$body.data.attributes.password).not.toBeDefined()
    })

    test('Returs a list of users', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate',
        password: 'baseplate',
      })
      const newUser = {
        username: 'yet-another-user',
        password: 'super-secret',
      }
      const req1 = new Request({
        accessToken,
        body: {
          data: {
            type: 'base$user',
            attributes: {
              accessLevel: 'user',
              ...newUser,
            },
          },
        },
        contentType: 'jsonApi',
        method: 'post',
        url: '/base$users',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: '/base$users',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(200)
      expect(res2.$body.data.length).toBe(3)

      const createdUser = res2.$body.data.find(
        (item: any) => item.attributes.username === newUser.username
      )

      expect(typeof createdUser.id).toBe('string')
      expect(createdUser.attributes.accessLevel).toBe('user')
      expect(createdUser.attributes.username).toBe(newUser.username)
      expect(createdUser.attributes.password).not.toBeDefined()
    })
  })
})
