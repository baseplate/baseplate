import {
  App,
  createUser,
  forEachApp,
  getAccessToken,
  Request,
  Response,
  wipeModels,
} from '../../../../test/utils'

import Author from '../../../../test/models/Author'
import Book from '../../../../test/models/Book'
import Genre from '../../../../test/models/Genre'

forEachApp([Author, Book, Genre], (app: App) => {
  describe('JSON:API – Creating resources', () => {
    beforeAll(async () => {
      await createUser({
        accessLevel: 'admin',
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
    })

    test('Returns an error when trying to create resources on a model that does not exist', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        body: {
          type: 'unicorn',
          attributes: {
            horns: 1,
          },
        },
        method: 'post',
        url: '/unicorns',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(404)
      expect(res.$body).toBeUndefined()
    })

    test('Returns an error when the requesting client does not have create access to the model', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
          },
        },
      })

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        body: {
          type: 'author',
          attributes: {
            firstName: 'Mark',
            lastName: 'Twain',
          },
        },
        method: 'post',
        url: '/authors',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(403)
      expect(res.$body.errors).toBeInstanceOf(Array)
    })

    test('Creates a resource', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
            create: true,
          },
        },
      })

      const author = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })

      // Verifying that the author doesn't exist yet.
      const req1 = new Request({
        accessToken,
        method: 'get',
        url: '/authors',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.$body.data.length).toBe(0)

      // Creating the author.
      const req2 = new Request({
        accessToken,
        body: {
          type: 'author',
          data: {
            attributes: author,
          },
        },
        method: 'post',
        url: '/authors',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.$body.data.length).toBe(1)
      expect(typeof res2.$body.data[0].id).toBe('string')
      expect(res2.$body.data[0].type).toBe('author')
      expect(res2.$body.data[0].attributes).toEqual(author)

      // Verifying that the author now exists.
      const req3 = new Request({
        accessToken: accessToken,
        method: 'get',
        url: '/authors',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(res2.$body.data.length).toBe(1)
      expect(res2.$body.data[0].id).toBe(res2.$body.data[0].id)
      expect(res2.$body.data[0].type).toBe('author')
      expect(res2.$body.data[0].attributes).toEqual(author)

      await wipeModels(['author'], app)
    })
  })
})
