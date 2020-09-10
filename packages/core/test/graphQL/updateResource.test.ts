import {
  App,
  createEntries,
  createUser,
  forEachDataConnector,
  getAccessToken,
  Request,
  resetMockDate,
  Response,
  setMockDate,
  wipeModels,
} from '../../../../test/utils'

import makeAuthor from '../../../../test/models/author'
import makeBook from '../../../../test/models/book'
import makeGenre from '../../../../test/models/genre'

forEachDataConnector((app: App, loadModels: Function) => {
  const Author = makeAuthor(app.BaseModel)
  const Book = makeBook(app.BaseModel)
  const Genre = makeGenre(app.BaseModel)

  describe('GraphQL – Updating resource', () => {
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
          query: `
            mutation UpdateUnicorn {
              updateUnicorn(id: "12345", update: {numberOfHorns: 1}) {
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
        `Cannot query field "updateUnicorn" on type "Mutation"`
      )
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
          query: `
            mutation UpdateAuthor {
              updateAuthor(id: "12345", update: {firstName: "John"}) {
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

      expect(res.$body.data.updateAuthor).toBeNull()
      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].message).toBe('Resource not found')
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

      const authors = await createEntries('author', app, [author1])
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        body: {
          query: `
            mutation UpdateAuthor($id: ID!, $firstName: String!, $lastName: String!) {
              updateAuthor(id: $id, update: {firstName: $firstName, lastName: $lastName}) {
                _id
                _createdAt
                _updatedAt
                firstName
                lastName
              }
            }
          `,
          variables: {
            id: authors[0].id,
            ...author2,
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.updateAuthor).toBeNull()
      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].message).toBe('Forbidden')

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

      const mockDate = new Date()

      setMockDate(mockDate)

      const authors = await createEntries('author', app, [originalAuthor])
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        body: {
          query: `
            mutation UpdateAuthor($id: ID!, $firstName: String!, $lastName: String!) {
              updateAuthor(id: $id, update: {firstName: $firstName, lastName: $lastName}) {
                _id
                _createdAt
                _updatedAt
                firstName
                lastName
              }
            }
          `,
          variables: {
            id: authors[0].id,
            ...updatedAuthor,
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.updateAuthor._id).toBe(authors[0].id)
      expect(res1.$body.data.updateAuthor._updatedAt).toBe(
        mockDate.toISOString()
      )
      expect(res1.$body.data.updateAuthor.firstName).toBe(
        updatedAuthor.firstName
      )
      expect(res1.$body.data.updateAuthor.lastName).toBe(updatedAuthor.lastName)

      const req2 = new Request({
        accessToken,
        body: {
          query: `
            {
              Author(_id: "${authors[0].id}") {
                _id
                _updatedAt
                firstName
                lastName
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(res2.$body.data.Author._id).toBe(authors[0].id)
      expect(res2.$body.data.Author._updatedAt).toBe(mockDate.toISOString())
      expect(res2.$body.data.Author.firstName).toBe(updatedAuthor.firstName)
      expect(res2.$body.data.Author.lastName).toBe(updatedAuthor.lastName)

      resetMockDate()

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
          query: `
            mutation UpdateBook($id: ID!, $isbn: Float!) {
              updateBook(id: $id, update: {isbn: $isbn}) {
                _id
                _createdAt
                _updatedAt
                title
                isbn
              }
            }
          `,
          variables: {
            id: books[0].id,
            isbn: book2.isbn,
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.updateBook).toBeNull()
      expect(res1.$body.errors.length).toBe(1)
      expect(res1.$body.errors[0].message).toBe('Unique constraint violation')

      const req2 = new Request({
        accessToken,
        body: {
          query: `
            {
              Book(_id: "${books[0].id}") {
                _id
                title
                isbn
              }
            }
          `,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(res2.$body.data.Book.isbn).toBe(book1.isbn)
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
      const req = new Request({
        accessToken,
        body: {
          query: `
            mutation UpdateStore($id: ID!, $name: String!) {
              updateStore(id: $id, update: {name: $name}) {
                _id
                _createdAt
                _updatedAt
                name
              }
            }
          `,
          variables: {
            id: stores[0].id,
            ...updatedStore,
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.updateStore).toBeNull()
      expect(res.$body.errors.length).toBe(1)
      expect(res.$body.errors[0].message).toBe('Entry validation error')
      expect(res.$body.errors[0].extensions.errorDetails[0].message).toBe(
        errorMessage
      )

      await wipeModels(['store'], app)
    })
  })
})
