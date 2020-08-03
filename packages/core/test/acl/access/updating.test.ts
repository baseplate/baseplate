import {
  App,
  createUser,
  forEachDataConnector,
  getAccessToken,
  Request,
  Response,
  wipeModels,
} from '../../../../../test/utils'

import Author from '../../../../../test/models/Author'
import Book from '../../../../../test/models/Book'
import Genre from '../../../../../test/models/Genre'

forEachDataConnector((app: App, loadModels: Function) => {
  describe('Updating access to resources', () => {
    beforeAll(async () => {
      await loadModels([Author, Book, Genre])
    })

    test("Allows an admin user to update a user's access to a resource", async () => {
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
      const user = await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
          },
        },
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
        body: {
          data: {
            type: 'author',
            attributes: author,
          },
        },
        method: 'post',
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
              create: true,
            },
          },
        },
        method: 'patch',
        url: `/base$models/author/access/base$user_${user.id}`,
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(200)
      expect(res2.$body.data.type).toBe('base$access')
      expect(res2.$body.data.id).toBe(`base$user_${user.id}`)
      expect(res2.$body.data.attributes.read).toBe(true)
      expect(res2.$body.data.attributes.create).toBe(true)
      expect(res2.$body.data.attributes.update).toBe(false)
      expect(res2.$body.data.attributes.delete).toBe(false)
      expect(res2.$body.data.relationships.user.data.type).toBe('base$user')
      expect(res2.$body.data.relationships.user.data.id).toBe(user.id)

      const req3 = new Request({
        accessToken: accessToken1,
        body: {
          data: {
            type: 'author',
            attributes: author,
          },
        },
        method: 'post',
        url: '/authors',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(res3.statusCode).toBe(201)
      expect(res3.$body.data.length).toBe(1)
      expect(res3.$body.data[0].type).toBe('author')
      expect(res3.$body.data[0].attributes).toEqual(author)

      await wipeModels(['author', 'base$access', 'base$user'], app)
    })

    test("Returns an error if a non-admin user tries to update another user's access to a resource", async () => {
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
            delete: true,
          },
        },
      })

      const grantee = await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
        permissions: {
          author: {
            read: true,
          },
        },
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
              create: true,
            },
          },
        },
        method: 'patch',
        url: `/base$models/author/access/base$user_${grantee.id}`,
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(403)

      const req2 = new Request({
        accessToken: accessToken2,
        body: {
          data: {
            type: 'author',
            attributes: author,
          },
        },
        method: 'post',
        url: '/authors',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(403)

      await wipeModels(['base$access', 'base$user'], app)
    })
  })
})
