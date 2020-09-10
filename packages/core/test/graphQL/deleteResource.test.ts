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

  describe('GraphQL – Deleting resource', () => {
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
        body: {
          query: `
            mutation DeleteUnicorn($id: ID!) {
              deleteUnicorn(id: $id) {
                deleteCount
              }
            }
          `,
          variables: {
            id: '123456',
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].message).toContain(
        `Cannot query field "deleteUnicorn" on type "Mutation"`
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
            mutation DeleteAuthor($id: ID!) {
              deleteAuthor(id: $id) {
                deleteCount
              }
            }
          `,
          variables: {
            id: '123456',
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.deleteAuthor.deleteCount).toBe(0)
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
        body: {
          query: `
            mutation DeleteAuthor($id: ID!) {
              deleteAuthor(id: $id) {
                deleteCount
              }
            }
          `,
          variables: {
            id: authors[0].id,
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res = new Response()

      await app.routesGraphQL.handler(req, res)

      expect(res.$body.data.deleteAuthor).toBeNull()
      expect(res.$body.errors).toBeInstanceOf(Array)
      expect(res.$body.errors[0].message).toBe('Forbidden')

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
        body: {
          query: `
            mutation DeleteAuthor($id: ID!) {
              deleteAuthor(id: $id) {
                deleteCount
              }
            }
          `,
          variables: {
            id: authors[0].id,
          },
        },
        method: 'post',
        url: '/graphql',
      })
      const res1 = new Response()

      await app.routesGraphQL.handler(req1, res1)

      expect(res1.$body.data.deleteAuthor.deleteCount).toBe(1)

      const req2 = new Request({
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
      const res2 = new Response()

      await app.routesGraphQL.handler(req2, res2)

      expect(res2.$body.data.Author).toBeNull()

      await wipeModels(['author'], app)
    })
  })
})
