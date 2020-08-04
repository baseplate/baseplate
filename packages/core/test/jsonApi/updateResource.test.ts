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
  describe('JSON:API – Updating resource', () => {
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

    test('Returns an error when trying to update resources on a model that does not exist', async () => {
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
        method: 'patch',
        url: '/unicorns/12345',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(404)
      expect(res.$body).toBeUndefined()
    })

    test('Returns an error when trying to update a resource that does not exist', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        body: {
          type: 'author',
          data: {
            attributes: {
              lastName: 'Doe',
            },
          },
        },
        method: 'patch',
        url: '/authors/12345',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(404)
      expect(res.$body.errors.length).toBe(1)
      expect(res.$body.errors[0].status).toBe(404)
      expect(res.$body.errors[0].title).toBe('Entry not found')
    })

    test('Returns an error when the requesting client does not have update access to the model', async () => {
      const author1 = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const author2 = {
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
            delete: true,
          },
        },
      })

      const authors = await createEntries('author', app, [author1, author2])
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
        method: 'patch',
        url: `/authors/${authors[0].id}`,
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(403)
      expect(res.$body.errors).toBeInstanceOf(Array)

      await wipeModels(['author'], app)
    })

    test('Updates a resource', async () => {
      const originalAuthor = {
        firstName: 'Mark',
        lastName: 'Twain',
      }
      const updatedAuthor = {
        firstName: 'Samuel',
        lastName: 'Clemens',
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
            update: true,
          },
        },
      })

      const authors = await createEntries('author', app, [originalAuthor])
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        body: {
          type: 'author',
          data: {
            attributes: updatedAuthor,
          },
        },
        method: 'patch',
        url: `/authors/${authors[0].id}`,
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(200)
      expect(res1.$body.data.type).toBe('author')
      expect(res1.$body.data.id).toBe(authors[0].id)
      expect(res1.$body.data.attributes).toEqual(updatedAuthor)

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: `/authors/${authors[0].id}`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(200)
      expect(res2.$body.data.type).toBe('author')
      expect(res2.$body.data.id).toBe(authors[0].id)
      expect(res2.$body.data.attributes).toEqual(updatedAuthor)

      await wipeModels(['author'], app)
    })

    test('Returns an error when trying to update a resource with a unique field to have the same value as another resource', async () => {
      const book1 = {
        title: 'Writing APIs is fun (Vol. 1)',
        isbn: 1111,
      }
      const book2 = {
        title: 'Writing APIs is fun (Vol. 2)',
        isbn: 2222,
      }
      const books = await createEntries('book', app, [book1, book2])
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
            attributes: {
              isbn: 2222,
            },
          },
        },
        method: 'patch',
        url: `/books/${books[0].id}`,
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(400)
      expect(res1.$body.errors.length).toBe(1)
      expect(res1.$body.errors[0].status).toBe(400)
      expect(res1.$body.errors[0].title).toBe('Unique constraint violation')

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: `/books/${books[0].id}`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.$body.data.id).toBe(books[0].id)
      expect(res2.$body.data.type).toBe('book')
      expect(res2.$body.data.attributes).toEqual(book1)
    })

    test('Returns an error if the update object fails the model validation', async () => {
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

      const originalStore = {
        name: 'The Cookie Store',
      }
      const updatedStore = {
        name: 'The Unicorn Store',
      }
      const stores = await createEntries('store', app, [originalStore])
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        body: {
          type: 'store',
          data: {
            attributes: updatedStore,
          },
        },
        method: 'patch',
        url: `/stores/${stores[0].id}`,
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
        method: 'get',
        url: `/stores/${stores[0].id}`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(200)
      expect(typeof res2.$body.data.id).toBe('string')
      expect(res2.$body.data.type).toBe('store')
      expect(res2.$body.data.attributes).toEqual(originalStore)

      await wipeModels(['store'], app)
    })
  })
})
