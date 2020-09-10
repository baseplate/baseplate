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

import makeAuthor from '../../../../test/models/author'
import makeBook from '../../../../test/models/book'
import makeGenre from '../../../../test/models/genre'

forEachDataConnector((app: App, loadModels: Function) => {
  const Author = makeAuthor(app.BaseModel)
  const Book = makeBook(app.BaseModel)
  const Genre = makeGenre(app.BaseModel)

  describe('JSON:API – Finding resources', () => {
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

    test('Returns an error when trying to list resources of a model that does not exist', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/unicorns',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(404)
      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].title).toBe('Resource not found')
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
        url: '/authors',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(200)
      expect(res1.$body.data).toBeInstanceOf(Array)

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: '/books',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(403)
      expect(res2.$body.errors).toBeInstanceOf(Array)
    })

    test('Returns a list of resources', async () => {
      const author1 = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const author2 = {
        firstName: 'José',
        lastName: 'Saramago',
      }
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const entries = await createEntries('author', app, [author1, author2])
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/authors',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(2)
      expect(res.$body.data[0].id).toBe(entries[0].id)
      expect(res.$body.data[0].attributes).toEqual(author1)
      expect(res.$body.data[1].id).toBe(entries[1].id)
      expect(res.$body.data[1].attributes).toEqual(author2)

      await wipeModels(['author'], app)
    })

    test('Hides any items which the requesting client does not have read access to', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
        permissions: {
          author: {
            read: {
              filter: {
                firstName: {
                  _ne: 'Leo',
                },
              },
            },
            create: true,
          },
        },
      })
      const author1 = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const author2 = {
        firstName: 'José',
        lastName: 'Saramago',
      }
      const entries = await createEntries('author', app, [author1, author2])
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken: accessToken,
        method: 'get',
        url: '/authors',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(1)
      expect(res.$body.data[0].id).toBe(entries[1].id)
      expect(res.$body.data[0].attributes).toEqual(author2)

      await wipeModels(['author'], app)
    })

    test('Respects pagination parameters and includes pagination links in the response', async () => {
      const authors = []

      for (let i = 1; i <= 20; i++) {
        authors.push({
          firstName: `Cyborg #${i}`,
          lastName: 'Tincan',
        })
      }

      const entries = await createEntries('author', app, authors)
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })

      let url = '/authors?page[size]=5'
      let idsFound = new Set()
      let requestsMade = 0

      do {
        const req = new Request({
          accessToken: accessToken,
          method: 'get',
          url,
        })
        const res = new Response()

        await app.routesRest.handler(req, res)

        requestsMade++

        expect(res.$body.meta.count).toBe(entries.length)
        expect(res.$body.meta.pageSize).toBeLessThanOrEqual(5)
        expect(res.$body.meta.totalPages).toBe(Math.ceil(entries.length / 5))
        expect(res.$body.links.self).toBe(url)

        res.$body.data.forEach((result: any) => {
          const match = entries.find((entry) => entry.id === result.id)

          if (match) {
            idsFound.add(result.id)
          }
        })

        url = res.$body.links.next
      } while (url)

      expect(idsFound.size).toBe(entries.length)
      expect(requestsMade).toBe(4)

      await wipeModels(['author'], app)
    })

    test('Respects a field projection', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const author1 = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const author2 = {
        firstName: 'José',
        lastName: 'Saramago',
      }
      const authors = await createEntries('author', app, [author1, author2])
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/authors?fields[author]=firstName',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(2)

      expect(res.$body.data[0].id).toBe(authors[0].id)
      expect(res.$body.data[0].attributes.firstName).toEqual(author1.firstName)
      expect(res.$body.data[0].attributes.lastName).toBeUndefined()
      expect(res.$body.data[1].id).toBe(authors[1].id)
      expect(res.$body.data[1].attributes.firstName).toEqual(author2.firstName)
      expect(res.$body.data[1].attributes.lastName).toBeUndefined()

      await wipeModels(['author'], app)
    })

    test('Respects a query filter', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const author1 = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const author2 = {
        firstName: 'José',
        lastName: 'Saramago',
      }
      const authors = await createEntries('author', app, [author1, author2])
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/authors?filter={"firstName":{"$ne":"Leo"}}',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(1)

      expect(res.$body.data[0].id).toBe(authors[1].id)
      expect(res.$body.data[0].attributes.firstName).toEqual(author2.firstName)
      expect(res.$body.data[0].attributes.lastName).toEqual(author2.lastName)

      await wipeModels(['author'], app)
    })

    test('Respects a sort parameter', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const author1 = {
        firstName: 'Jane',
        lastName: 'Austen',
      }
      const author2 = {
        firstName: 'Charles',
        lastName: 'Dickens',
      }
      const author3 = {
        firstName: 'Charles',
        lastName: 'Darwin',
      }
      const authors = await createEntries('author', app, [
        author1,
        author2,
        author3,
      ])

      const req1 = new Request({
        accessToken,
        method: 'get',
        url: '/authors?sort=firstName',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.$body.data.length).toBe(3)
      expect(res1.$body.data[0].id).toBe(authors[1].id)
      expect(res1.$body.data[0].attributes.firstName).toEqual(author2.firstName)
      expect(res1.$body.data[0].attributes.lastName).toEqual(author2.lastName)
      expect(res1.$body.data[1].id).toBe(authors[2].id)
      expect(res1.$body.data[1].attributes.firstName).toEqual(author3.firstName)
      expect(res1.$body.data[1].attributes.lastName).toEqual(author3.lastName)
      expect(res1.$body.data[2].id).toBe(authors[0].id)
      expect(res1.$body.data[2].attributes.firstName).toEqual(author1.firstName)
      expect(res1.$body.data[2].attributes.lastName).toEqual(author1.lastName)

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: '/authors?sort=lastName',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.$body.data.length).toBe(3)
      expect(res2.$body.data[0].id).toBe(authors[0].id)
      expect(res2.$body.data[0].attributes.firstName).toEqual(author1.firstName)
      expect(res2.$body.data[0].attributes.lastName).toEqual(author1.lastName)
      expect(res2.$body.data[1].id).toBe(authors[2].id)
      expect(res2.$body.data[1].attributes.firstName).toEqual(author3.firstName)
      expect(res2.$body.data[1].attributes.lastName).toEqual(author3.lastName)
      expect(res2.$body.data[2].id).toBe(authors[1].id)
      expect(res2.$body.data[2].attributes.firstName).toEqual(author2.firstName)
      expect(res2.$body.data[2].attributes.lastName).toEqual(author2.lastName)

      const req3 = new Request({
        accessToken,
        method: 'get',
        url: '/authors?sort=firstName,-lastName',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(res3.$body.data.length).toBe(3)
      expect(res3.$body.data[0].id).toBe(authors[1].id)
      expect(res3.$body.data[0].attributes.firstName).toEqual(author2.firstName)
      expect(res3.$body.data[0].attributes.lastName).toEqual(author2.lastName)
      expect(res3.$body.data[1].id).toBe(authors[2].id)
      expect(res3.$body.data[1].attributes.firstName).toEqual(author3.firstName)
      expect(res3.$body.data[1].attributes.lastName).toEqual(author3.lastName)
      expect(res3.$body.data[2].id).toBe(authors[0].id)
      expect(res3.$body.data[2].attributes.firstName).toEqual(author1.firstName)
      expect(res3.$body.data[2].attributes.lastName).toEqual(author1.lastName)

      await wipeModels(['author'], app)
    })

    test('Includes referenced resources', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const author1 = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const author2 = {
        firstName: 'José',
        lastName: 'Saramago',
      }
      const authors = await createEntries('author', app, [author1, author2])
      const book1 = {
        title: 'War and Peace',
        isbn: 123,
        author: authors[0].id,
      }
      const book2 = {
        title: 'Blindness',
        isbn: 234,
        author: authors[1].id,
      }
      const books = await createEntries('book', app, [book1, book2])
      const req = new Request({
        accessToken,
        method: 'get',
        url:
          '/books?fields[author]=firstName&fields[book]=title,author&include=author',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(2)

      expect(res.$body.data[0].id).toBe(books[0].id)
      expect(res.$body.data[0].attributes.title).toEqual(book1.title)
      expect(res.$body.data[0].attributes.isbn).toBeUndefined()

      expect(res.$body.data[1].id).toBe(books[1].id)
      expect(res.$body.data[1].attributes.title).toEqual(book2.title)
      expect(res.$body.data[1].attributes.isbn).toBeUndefined()

      let includedAuthors = new Set()

      res.$body.included.forEach((item: any) => {
        const match = authors.find((author) => author.id === item.id)

        if (match) {
          includedAuthors.add(item.id)

          expect(item.attributes.firstName).toBeDefined()
          expect(item.attributes.lastName).toBeUndefined()
        }
      })

      expect(includedAuthors.size).toBe(authors.length)

      await wipeModels(['author', 'book'], app)
    })

    test('Does not include referenced resources for which the requesting client does not have sufficient permissions for', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user3',
        password: 'baseplate',
        permissions: {
          author: {
            read: {
              filter: {
                lastName: {
                  _ne: 'Saramago',
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
        username: 'baseplate-user3',
        password: 'baseplate',
      })
      const author1 = {
        firstName: 'Leo',
        lastName: 'Tolstoy',
      }
      const author2 = {
        firstName: 'José',
        lastName: 'Saramago',
      }
      const authors = await createEntries('author', app, [author1, author2])
      const book1 = {
        title: 'War and Peace',
        isbn: 123,
        author: authors[0].id,
      }
      const book2 = {
        title: 'Blindness',
        isbn: 234,
        author: authors[1].id,
      }
      const books = await createEntries('book', app, [book1, book2])
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/books?include=author',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(2)

      expect(res.$body.data[0].id).toBe(books[0].id)
      expect(res.$body.data[0].attributes.title).toBe(book1.title)
      expect(res.$body.data[0].attributes.isbn).toBe(book1.isbn)

      expect(res.$body.data[1].id).toBe(books[1].id)
      expect(res.$body.data[1].attributes.title).toBe(book2.title)
      expect(res.$body.data[1].attributes.isbn).toBe(book2.isbn)

      expect(res.$body.included.length).toBe(1)
      expect(res.$body.included[0].type).toBe('author')
      expect(res.$body.included[0].id).toBe(authors[0].id)
      expect(res.$body.included[0].attributes).toEqual(author1)

      await wipeModels(['author', 'book'], app)
    })
  })
})
