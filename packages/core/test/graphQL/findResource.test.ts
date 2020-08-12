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
  describe('GraphQL – Finding resource', () => {
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
        body: {
          query: `
            {
              Unicorn(_id: "123456") {
                _id
                numberOfHorns
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].message).toContain(
        `Cannot query field "Unicorn" on type "Query"`
      )
    })

    test('Returns an error when the requesting client does not have read access to the model', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
        permissions: {
          book: {
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
        body: {
          query: `
            {
              Author(_id: "${authors[0].id}") {
                _id
                firstName
                lastName
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.Author).toBeNull()
      expect(res1.$body.errors).toBeInstanceOf(Array)
      expect(res1.$body.errors[0].message).toBe('Forbidden')

      const req2 = new Request({
        accessToken,
        body: {
          query: `
            {
              Book(_id: "${books[0].id}") {
                _id
                title
                author {
                  _id
                }
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(res2.$body.data.Book._id).toBe(books[0].id)
      expect(res2.$body.data.Book.title).toEqual(book1.title)
      expect(res2.$body.data.Book.author).toBeNull()
    })

    test('Returns null when the requesting client does not have access to the resource because of a permissions filter', async () => {
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
      const req = new Request({
        accessToken,
        body: {
          query: `
            {
              Author(_id: "${authors[1].id}") {
                _id
                firstName
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.Author).toBeNull()
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
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        body: {
          query: `
            {
              Author(_id: "${authors[0].id}") {
                _id
                firstName
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.Author._id).toBe(authors[0].id)
      expect(res.$body.data.Author.firstName).toBe(author1.firstName)
    })

    test('Returns only the requested fields', async () => {
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

      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user5',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        body: {
          query: `
            {
              Author(_id: "${authors[0].id}") {
                _id
                lastName
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.Author._id).toBe(authors[0].id)
      expect(res.$body.data.Author.firstName).toBeUndefined()
      expect(res.$body.data.Author.lastName).toBe(author1.lastName)
    })

    test('Includes referenced resources', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        body: {
          query: `
            {
              Book(_id: "${books[0].id}") {
                _id
                title
                isbn
                author {
                  _id
                  lastName
                }
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.Book._id).toBe(books[0].id)
      expect(res.$body.data.Book.title).toBe(book1.title)
      expect(res.$body.data.Book.isbn).toBe(book1.isbn)
      expect(res.$body.data.Book.author._id).toBe(authors[0].id)
      expect(res.$body.data.Book.author.firstName).toBeUndefined()
      expect(res.$body.data.Book.author.lastName).toBe(author1.lastName)
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
        body: {
          query: `
            {
              Book(_id: "${books[0].id}") {
                _id
                title
                isbn
                author {
                  _id
                  lastName
                }
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.Book._id).toBe(books[0].id)
      expect(res1.$body.data.Book.title).toBe(book1.title)
      expect(res1.$body.data.Book.isbn).toBe(book1.isbn)
      expect(res1.$body.data.Book.author._id).toBe(authors[0].id)
      expect(res1.$body.data.Book.author.firstName).toBeUndefined()
      expect(res1.$body.data.Book.author.lastName).toBe(author1.lastName)

      const req2 = new Request({
        accessToken,
        body: {
          query: `
            {
              Book(_id: "${books[1].id}") {
                _id
                title
                isbn
                author {
                  _id
                  lastName
                }
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(res2.$body.data.Book._id).toBe(books[1].id)
      expect(res2.$body.data.Book.title).toBe(book2.title)
      expect(res2.$body.data.Book.isbn).toBe(book2.isbn)
      expect(res2.$body.data.Book.author).toBeNull()
    })
  })
})
