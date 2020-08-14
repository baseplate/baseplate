import {
  App,
  createEntries,
  createUser,
  forEachDataConnector,
  getAccessToken,
  Request,
  Response,
  wipeModels,
} from '../../../../test/utils'

import Author from '../../../../test/models/Author'
import Book from '../../../../test/models/Book'
import Genre from '../../../../test/models/Genre'

forEachDataConnector((app: App, loadModels: Function) => {
  describe('JSON:API – Deleting resource', () => {
    beforeAll(async () => {
      await createUser({
        accessLevel: 'admin',
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })

      await loadModels([Author, Book, Genre])
    })

    afterAll(async () => {
      await wipeModels(['base$user'], app)
    })

    test('Returns an error when trying to delete resources on a model that does not exist', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'delete',
        url: '/unicorns/12345',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(404)
      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].title).toBe('Resource not found')
    })

    test('Returns an error when trying to update a resource that does not exist', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'delete',
        url: '/authors/12345',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(404)
      expect(res.$body.errors.length).toBe(1)
      expect(res.$body.errors[0].status).toBe(404)
      expect(res.$body.errors[0].title).toBe('Resource not found')
    })

    test('Returns an error when the requesting client does not have update access to the model', async () => {
      const author = {
        firstName: 'José',
        lastName: 'Saramago',
      }

      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
            create: true,
            update: true,
          },
        },
      })

      const authors = await createEntries('author', app, [author])
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'delete',
        url: `/authors/${authors[0].id}`,
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(403)
      expect(res.$body.errors).toBeInstanceOf(Array)

      await wipeModels(['author'], app)
    })

    test('Deletes a resource', async () => {
      const author = {
        firstName: 'José',
        lastName: 'Saramago',
      }

      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
            create: true,
            delete: true,
          },
        },
      })

      const authors = await createEntries('author', app, [author])
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        method: 'delete',
        url: `/authors/${authors[0].id}`,
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(204)
      expect(res1.$body).toBeNull()

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: `/authors/${authors[0].id}`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(404)

      await wipeModels(['author'], app)
    })
  })
})
