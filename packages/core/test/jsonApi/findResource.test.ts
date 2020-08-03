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
  describe('JSON:API – Finding resource', () => {
    const author1 = {
      firstName: 'Leo',
      lastName: 'Tolstoy',
    }
    const author2 = {
      firstName: 'José',
      lastName: 'Saramago',
    }
    const book1 = {
      title: 'War and Peace',
      isbn: 123,
    }
    const book2 = {
      title: 'Blindness',
      isbn: 234,
    }

    let authors: any
    let books: any

    beforeAll(async () => {
      await createUser({
        accessLevel: 'admin',
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })

      await loadModels([Author, Book, Genre])

      authors = await createEntries('author', app, [author1, author2])
      books = await createEntries('book', app, [
        {...book1, author: {type: 'author', id: authors[0].id}},
        {...book2, author: {type: 'author', id: authors[1].id}},
      ])
    })

    afterAll(async () => {
      await wipeModels(['author', 'book', 'base$access', 'base$user'], app)
    })

    test('Returns an error when trying to find a resource of a model that does not exist', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/unicorns/12345',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(404)
      expect(res.$body).toBeUndefined()
    })

    test('Returns an error when the requesting client does not have read access to the model', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
            create: true,
          },
        },
      })

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        method: 'get',
        url: `/authors/${authors[0].id}`,
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(200)
      expect(typeof res1.$body.data.id).toBe('string')

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: `/books/${books[0].id}`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(403)
      expect(res2.$body.errors).toBeInstanceOf(Array)
    })

    test('Returns an error when the requesting client is forbidden access to the resource because of a permissions filter', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
        permissions: {
          author: {
            read: {
              filter: {
                lastName: {
                  $ne: 'Saramago',
                },
              },
            },
          },
        },
      })

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        method: 'get',
        url: `/authors/${authors[0].id}`,
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(200)
      expect(typeof res1.$body.data.id).toBe('string')

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: `/authors/${authors[1].id}`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(404)
      expect(res2.$body.errors).toBeInstanceOf(Array)
    })

    test('Returns a resource by ID', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user3',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
          },
        },
      })

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user3',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: `/authors/${authors[0].id}`,
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.$body.data.id).toBe(authors[0].id)
    })

    test('Includes links block in the response', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user4',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
          },
        },
      })

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user4',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: `/authors/${authors[0].id}`,
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.$body.data.id).toBe(authors[0].id)
      expect(res.$body.links.self).toBe(`/authors/${authors[0].id}`)
    })

    test('Respects a field projection', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user5',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
          },
        },
      })

      const url = `/authors/${authors[0].id}?fields[author]=lastName`
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user5',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url,
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.$body.data.id).toBe(authors[0].id)
      expect(res.$body.data.attributes.firstName).toBeUndefined()
      expect(res.$body.data.attributes.lastName).toBe(author1.lastName)
      expect(res.$body.links.self).toBe(url)
    })

    test('Includes referenced resources', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const url = `/books/${books[0].id}?include=author`
      const req = new Request({
        accessToken,
        method: 'get',
        url,
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.$body.data.id).toBe(books[0].id)
      expect(res.$body.data.attributes).toEqual(book1)
      expect(res.$body.data.relationships.author.data.type).toBe('author')
      expect(res.$body.data.relationships.author.data.id).toBe(authors[0].id)
      expect(res.$body.included.length).toBe(1)
      expect(res.$body.included[0].type).toBe('author')
      expect(res.$body.included[0].id).toBe(authors[0].id)
      expect(res.$body.included[0].attributes).toEqual(author1)
      expect(res.$body.links.self).toBe(url)
    })

    test('Does not include referenced resources to which the requesting client does not have access', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user6',
        password: 'baseplate',
        permissions: {
          author: {
            read: {
              filter: {
                lastName: {
                  $ne: 'Saramago',
                },
              },
            },
          },
          book: {
            read: true,
          },
        },
      })

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user6',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        method: 'get',
        url: `/books/${books[0].id}?include=author`,
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(200)
      expect(res1.$body.data.id).toBe(books[0].id)
      expect(res1.$body.data.attributes).toEqual(book1)
      expect(res1.$body.data.relationships.author.data.type).toBe('author')
      expect(res1.$body.data.relationships.author.data.id).toBe(authors[0].id)
      expect(res1.$body.included.length).toBe(1)
      expect(res1.$body.included[0].type).toBe('author')
      expect(res1.$body.included[0].id).toBe(authors[0].id)
      expect(res1.$body.included[0].attributes).toEqual(author1)

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: `/books/${books[1].id}?include=author`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(200)
      expect(res2.$body.data.id).toBe(books[1].id)
      expect(res2.$body.data.attributes).toEqual(book2)
      expect(res2.$body.data.relationships.author.data.type).toBe('author')
      expect(res2.$body.data.relationships.author.data.id).toBe(authors[1].id)
      expect(res2.$body.included).toBeUndefined()
    })

    describe('Retrieving linked resources', () => {
      test('Returns the resource linked by a relationship field', async () => {
        await createUser({
          accessLevel: 'user',
          app,
          username: 'baseplate-user7',
          password: 'baseplate',
          permissions: {
            author: {
              read: true,
            },
            book: {
              read: true,
            },
          },
        })

        const url = `/books/${books[0].id}/author`
        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-user7',
          password: 'baseplate',
        })
        const req = new Request({
          accessToken,
          method: 'get',
          url,
        })
        const res = new Response()

        await app.routesRest.handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.$body.data.id).toBe(authors[0].id)
        expect(res.$body.data.attributes).toEqual(author1)
        expect(res.$body.links.self).toBe(url)
      })

      test('Returns an error if the requesting client does not have access to the parent resource', async () => {
        await createUser({
          accessLevel: 'user',
          app,
          username: 'baseplate-user8',
          password: 'baseplate',
          permissions: {
            author: {
              read: true,
            },
          },
        })

        const url = `/books/${books[0].id}/author`
        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-user8',
          password: 'baseplate',
        })
        const req = new Request({
          accessToken,
          method: 'get',
          url,
        })
        const res = new Response()

        await app.routesRest.handler(req, res)

        expect(res.statusCode).toBe(403)
        expect(res.$body.errors).toBeInstanceOf(Array)
      })

      test('Returns an error if the requesting client does not have access to the linked resource', async () => {
        await createUser({
          accessLevel: 'user',
          app,
          username: 'baseplate-user9',
          password: 'baseplate',
          permissions: {
            book: {
              read: true,
            },
          },
        })

        const url = `/books/${books[0].id}/author`
        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-user9',
          password: 'baseplate',
        })
        const req = new Request({
          accessToken,
          method: 'get',
          url,
        })
        const res = new Response()

        await app.routesRest.handler(req, res)

        expect(res.statusCode).toBe(403)
        expect(res.$body.errors).toBeInstanceOf(Array)
      })
    })
  })
})
