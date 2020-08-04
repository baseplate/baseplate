import {
  App,
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
  describe('JSON:API – Creating resource', () => {
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
          data: {
            attributes: {
              horns: 1,
            },
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
          data: {
            attributes: {
              firstName: 'Mark',
              lastName: 'Twain',
            },
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

    test('Returns an error when trying to create a resource with a unique field that has the same value as another resource', async () => {
      const book1 = {
        title: 'Writing APIs is fun (Vol. 1)',
        isbn: 12345,
      }
      const book2 = {
        title: 'Writing APIs is fun (Vol. 2)',
        isbn: 12345,
      }
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })

      const req1 = new Request({
        accessToken,
        body: {
          type: 'book',
          data: {
            attributes: book1,
          },
        },
        method: 'post',
        url: '/books',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(201)
      expect(res1.$body.data.length).toBe(1)
      expect(typeof res1.$body.data[0].id).toBe('string')
      expect(res1.$body.data[0].type).toBe('book')
      expect(res1.$body.data[0].attributes).toEqual(book1)

      const req2 = new Request({
        accessToken,
        body: {
          type: 'book',
          data: {
            attributes: book2,
          },
        },
        method: 'post',
        url: '/books',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(400)
      expect(res2.$body.errors.length).toBe(1)
      expect(res2.$body.errors[0].status).toBe(400)
      expect(res2.$body.errors[0].title).toBe('Unique constraint violation')

      const req3 = new Request({
        accessToken: accessToken,
        method: 'get',
        url: '/books',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(res3.$body.data.length).toBe(1)
      expect(res3.$body.data[0].id).toBe(res3.$body.data[0].id)
      expect(res3.$body.data[0].type).toBe('book')
      expect(res3.$body.data[0].attributes).toEqual(book1)

      await wipeModels(['book'], app)
    })

    test('Returns an error if the model validation fails', async () => {
      const errorMessage = 'You cannot sell unicorns!'
      const Store = {
        fields: {
          name: {
            type: String,
            validate: (input: string) => !input.includes('Unicorn'),
            errorMessage,
          },
        },
        name: 'store',
      }

      await loadModels([Store])

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const store1 = {
        name: 'The Unicorn Store',
      }
      const store2 = {
        name: 'The Cookie Store',
      }
      const req1 = new Request({
        accessToken,
        body: {
          type: 'store',
          data: {
            attributes: store1,
          },
        },
        method: 'post',
        url: '/stores',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(400)
      expect(res1.$body.errors.length).toBe(1)
      expect(res1.$body.errors[0].status).toBe(400)
      expect(res1.$body.errors[0].title).toBe(errorMessage)
      expect(res1.$body.errors[0].source.pointer).toBe('/data/attributes/name')

      const req2 = new Request({
        accessToken,
        body: {
          type: 'store',
          data: {
            attributes: store2,
          },
        },
        method: 'post',
        url: '/stores',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(201)
      expect(res2.$body.data.length).toBe(1)
      expect(typeof res2.$body.data[0].id).toBe('string')
      expect(res2.$body.data[0].type).toBe('store')
      expect(res2.$body.data[0].attributes).toEqual(store2)

      await wipeModels(['store'], app)
    })
  })
})
