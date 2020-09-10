import {
  App,
  createEntries,
  createUser,
  forEachDataConnector,
  getAccessToken,
  Request,
  Response,
  wipeModels,
} from '../../../../../test/utils'

import makeAuthor from '../../../../../test/models/author'
import makeBook from '../../../../../test/models/book'
import makeGenre from '../../../../../test/models/genre'

forEachDataConnector((app: App, loadModels: Function) => {
  const Author = makeAuthor(app.BaseModel)
  const Book = makeBook(app.BaseModel)
  const Genre = makeGenre(app.BaseModel)

  describe('Granting access to resources', () => {
    beforeAll(async () => {
      await loadModels([Author, Book, Genre])
    })

    test('Allows an admin user to grant a user access to a resource', async () => {
      await createUser({
        accessLevel: 'admin',
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })

      const author = {
        firstName: 'José',
        lastName: 'Saramago',
      }
      const authors = await createEntries('author', app, [author])
      const user = await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user',
        password: 'baseplate',
      })
      const accessToken1 = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const accessToken2 = await getAccessToken({
        app,
        username: 'baseplate-user',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken: accessToken2,
        method: 'get',
        url: '/authors',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(403)

      const req2 = new Request({
        accessToken: accessToken1,
        body: {
          data: {
            type: 'base$access',
            attributes: {
              read: true,
            },
            relationships: {
              user: {
                data: {
                  type: 'base$user',
                  id: user.id,
                },
              },
            },
          },
        },
        method: 'post',
        url: '/base$models/author/access',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(201)
      expect(res2.$body.data.length).toBe(1)
      expect(res2.$body.data[0].type).toBe('base$access')
      expect(typeof res2.$body.data[0].id).toBe('string')
      expect(res2.$body.data[0].attributes.read).toBe(true)
      expect(res2.$body.data[0].attributes.create).toBe(false)
      expect(res2.$body.data[0].attributes.update).toBe(false)
      expect(res2.$body.data[0].attributes.delete).toBe(false)
      expect(res2.$body.data[0].relationships.user.data.type).toBe('base$user')
      expect(res2.$body.data[0].relationships.user.data.id).toBe(user.id)
      expect(res2.$body.data[0].links.self).toBe(
        `/base$models/author/access/base$user_${user.id}`
      )

      const req3 = new Request({
        accessToken: accessToken2,
        method: 'get',
        url: '/authors',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(res3.statusCode).toBe(200)
      expect(res3.$body.data.length).toBe(1)
      expect(res3.$body.data[0].type).toBe('author')
      expect(res3.$body.data[0].id).toBe(authors[0].id)
      expect(res3.$body.data[0].attributes).toEqual(author)

      await wipeModels(['author', 'base$access', 'base$user'], app)
    })

    test('Returns an error if a non-admin user tries to grant another user access to a resource they have access to it themselves', async () => {
      const author = {
        firstName: 'José',
        lastName: 'Saramago',
      }

      await createEntries('author', app, [author])
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
            delete: true,
          },
        },
      })

      const grantee = await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const accessToken1 = await getAccessToken({
        app,
        username: 'baseplate-user1',
        password: 'baseplate',
      })
      const accessToken2 = await getAccessToken({
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken: accessToken1,
        body: {
          data: {
            type: 'base$access',
            attributes: {
              read: true,
            },
            relationships: {
              user: {
                data: {
                  type: 'base$user',
                  id: grantee.id,
                },
              },
            },
          },
        },
        method: 'post',
        url: '/base$models/book/access',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(403)

      const req2 = new Request({
        accessToken: accessToken2,
        method: 'get',
        url: '/authors',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(403)

      await wipeModels(['author', 'base$access', 'base$user'], app)
    })
  })
})
