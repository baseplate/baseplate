import {
  App,
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

  describe('GraphQL – Creating resource', () => {
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
          query: `
            mutation CreateUnicorn {
              createUnicorn(data: {numberOfHorns: 1}) {
                _id
                _createdAt
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
        `Cannot query field "createUnicorn" on type "Mutation"`
      )
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
          query: `
            mutation CreateAuthor {
              createAuthor(data: {firstName: "Mark", lastName: "Twain"}) {
                _id
                _createdAt
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

      expect(res.$body.data.createAuthor).toBeNull()
      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].message).toBe('Forbidden')
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

      const mockDate = new Date()

      setMockDate(mockDate)

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
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.Authors.length).toBe(0)

      // Creating the author.
      const req2 = new Request({
        accessToken,
        body: {
          query: `
            mutation CreateAuthor($firstName: String!, $lastName: String!) {
              createAuthor(data: {firstName: $firstName, lastName: $lastName}) {
                _id
                _createdAt
                firstName
                lastName
              }
            }
          `,
          variables: author,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(typeof res2.$body.data.createAuthor._id).toBe('string')
      expect(res2.$body.data.createAuthor._createdAt).toBe(
        mockDate.toISOString()
      )
      expect(res2.$body.data.createAuthor.firstName).toBe(author.firstName)
      expect(res2.$body.data.createAuthor.lastName).toBe(author.lastName)

      // Verifying that the author now exists.
      const req3 = new Request({
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
      const res3 = new Response()

      await app.routesGraphQL.handler(req3, res3)

      expect(res3.$body.data.Authors.length).toBe(1)
      expect(res3.$body.data.Authors[0]._id).toBe(
        res2.$body.data.createAuthor._id
      )
      expect(res3.$body.data.Authors[0].firstName).toBe(author.firstName)
      expect(res3.$body.data.Authors[0].lastName).toBe(author.lastName)

      resetMockDate()

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
          query: `
            mutation CreateBook($title: String!, $isbn: Float) {
              createBook(data: {title: $title, isbn: $isbn}) {
                _id
                _createdAt
                title
                isbn
              }
            }
          `,
          variables: book1,
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(typeof res1.$body.data.createBook._id).toBe('string')
      expect(res1.$body.data.createBook.title).toBe(book1.title)
      expect(res1.$body.data.createBook.isbn).toBe(book1.isbn)

      const req2 = new Request({
        accessToken,
        body: {
          query: `
            mutation CreateBook($title: String!, $isbn: Float) {
              createBook(data: {title: $title, isbn: $isbn}) {
                _id
                _createdAt
                title
                isbn
              }
            }
          `,
          variables: book2,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(res2.$body.data.createBook).toBeNull()
      expect(res2.$body.errors.length).toBe(1)
      expect(res2.$body.errors[0].message).toBe('Unique constraint violation')

      const req3 = new Request({
        accessToken: accessToken,
        body: {
          query: `
            {
              Books {
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
      const res3 = new Response()

      await app.routesGraphQL.handler(req3, res3)

      expect(res3.$body.data.Books.length).toBe(1)
      expect(res3.$body.data.Books[0]._id).toBe(res1.$body.data.createBook._id)
      expect(res3.$body.data.Books[0].title).toBe(book1.title)
      expect(res3.$body.data.Books[0].isbn).toBe(book1.isbn)

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
          query: `
            mutation CreateStore($name: String!) {
              createStore(data: {name: $name}) {
                _id
                _createdAt
                name
              }
            }
          `,
          variables: store1,
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.createStore).toBeNull()
      expect(res1.$body.errors.length).toBe(1)
      expect(res1.$body.errors[0].message).toBe('Entry validation error')
      expect(res1.$body.errors[0].extensions.errorDetails[0].message).toBe(
        errorMessage
      )

      const req2 = new Request({
        accessToken,
        body: {
          query: `
            mutation CreateStore($name: String!) {
              createStore(data: {name: $name}) {
                _id
                _createdAt
                name
              }
            }
          `,
          variables: store2,
        },
        method: 'post',
        url: '/graphql',
      })
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(typeof res2.$body.data.createStore._id).toBe('string')
      expect(res2.$body.data.createStore.name).toBe(store2.name)

      await wipeModels(['store'], app)
    })
  })
})
