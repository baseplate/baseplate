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
  describe('GraphQL – Finding resources', () => {
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
        body: {
          query: `
            {
              Unicorns {
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
        `Cannot query field "Unicorns" on type "Query"`
      )
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
        body: {
          query: `
            {
              Authors {
                _id
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.Authors).toBeInstanceOf(Array)

      const req2 = new Request({
        accessToken,
        body: {
          query: `
            {
              Books {
                _id
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(res2.$body.data.Books).toBeNull()
      expect(res2.$body.errors).toBeInstanceOf(Array)
      expect(res2.$body.errors[0].message).toBe('Forbidden')
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
        body: {
          query: `
            {
              Authors {
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
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.Authors.length).toBe(2)
      expect(res.$body.data.Authors[0]._id).toBe(entries[0].id)
      expect(res.$body.data.Authors[0].firstName).toEqual(author1.firstName)
      expect(res.$body.data.Authors[0].lastName).toEqual(author1.lastName)
      expect(res.$body.data.Authors[1]._id).toBe(entries[1].id)
      expect(res.$body.data.Authors[1].firstName).toEqual(author2.firstName)
      expect(res.$body.data.Authors[1].lastName).toEqual(author2.lastName)

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
                  $ne: 'Leo',
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
        body: {
          query: `
            {
              Authors {
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
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.Authors.length).toBe(1)
      expect(res.$body.data.Authors[0]._id).toBe(entries[1].id)
      expect(res.$body.data.Authors[0].firstName).toEqual(author2.firstName)
      expect(res.$body.data.Authors[0].lastName).toEqual(author2.lastName)

      await wipeModels(['author'], app)
    })

    test('Returns only the requested fields', async () => {
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
        body: {
          query: `
            {
              Authors {
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

      expect(res.$body.data.Authors.length).toBe(2)

      expect(res.$body.data.Authors[0]._id).toBe(authors[0].id)
      expect(res.$body.data.Authors[0].firstName).toEqual(author1.firstName)
      expect(res.$body.data.Authors[0].lastName).toBeUndefined()
      expect(res.$body.data.Authors[1]._id).toBe(authors[1].id)
      expect(res.$body.data.Authors[1].firstName).toEqual(author2.firstName)
      expect(res.$body.data.Authors[1].lastName).toBeUndefined()

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
        body: {
          query: `
            {
              Authors(firstName: {_ne: "Leo"}) {
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
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.Authors.length).toBe(1)

      expect(res.$body.data.Authors[0]._id).toBe(authors[1].id)
      expect(res.$body.data.Authors[0].firstName).toEqual(author2.firstName)
      expect(res.$body.data.Authors[0].lastName).toEqual(author2.lastName)

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
        author: {type: 'author', id: authors[0].id},
      }
      const book2 = {
        title: 'Blindness',
        isbn: 234,
        author: {type: 'author', id: authors[1].id},
      }
      const books = await createEntries('book', app, [book1, book2])
      const req = new Request({
        accessToken,
        body: {
          query: `
            {
              Books {
                _id
                title
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

      expect(res.$body.data.Books.length).toBe(2)

      expect(res.$body.data.Books[0]._id).toBe(books[0].id)
      expect(res.$body.data.Books[0].title).toEqual(book1.title)
      expect(res.$body.data.Books[0].isbn).toBeUndefined()
      expect(res.$body.data.Books[0].author._id).toBe(authors[0].id)
      expect(res.$body.data.Books[0].author.firstName).toBeUndefined()
      expect(res.$body.data.Books[0].author.lastName).toBe(author1.lastName)

      expect(res.$body.data.Books[1]._id).toBe(books[1].id)
      expect(res.$body.data.Books[1].title).toEqual(book2.title)
      expect(res.$body.data.Books[1].isbn).toBeUndefined()
      expect(res.$body.data.Books[1].author._id).toBe(authors[1].id)
      expect(res.$body.data.Books[1].author.firstName).toBeUndefined()
      expect(res.$body.data.Books[1].author.lastName).toBe(author2.lastName)

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
        author: {type: 'author', id: authors[0].id},
      }
      const book2 = {
        title: 'Blindness',
        isbn: 234,
        author: {type: 'author', id: authors[1].id},
      }
      const books = await createEntries('book', app, [book1, book2])
      const req = new Request({
        accessToken,
        body: {
          query: `
            {
              Books {
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

      expect(res.$body.data.Books.length).toBe(2)

      expect(res.$body.data.Books[0]._id).toBe(books[0].id)
      expect(res.$body.data.Books[0].title).toBe(book1.title)
      expect(res.$body.data.Books[0].isbn).toBe(book1.isbn)
      expect(res.$body.data.Books[0].author._id).toBe(authors[0].id)
      expect(res.$body.data.Books[0].author.firstName).toBeUndefined()
      expect(res.$body.data.Books[0].author.lastName).toBe(author1.lastName)

      expect(res.$body.data.Books[1]._id).toBe(books[1].id)
      expect(res.$body.data.Books[1].title).toBe(book2.title)
      expect(res.$body.data.Books[1].isbn).toBe(book2.isbn)
      expect(res.$body.data.Books[1].author).toBeNull()

      await wipeModels(['author', 'book'], app)
    })
  })
})
