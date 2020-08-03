import {
  App,
  createEntries,
  createUser,
  forEachDataConnector,
  getAccessToken,
  Request,
  Response,
  wipeModels,
} from '../../../test/utils'

import Author from '../../../test/models/Author'
import Book from '../../../test/models/Book'
import Genre from '../../../test/models/Genre'

forEachDataConnector((app: App, loadModels: Function) => {
  describe('User Management', () => {
    beforeAll(async () => {
      const User = app.modelStore.get('base$user')

      await User.create(
        {
          accessLevel: 'admin',
          username: 'baseplate-admin',
          password: 'baseplate',
        },
        {authenticate: false}
      )

      await User.create(
        {
          accessLevel: 'user',
          username: 'baseplate-user',
          password: 'baseplate',
        },
        {authenticate: false}
      )

      await loadModels([Author, Book, Genre])
    })

    test('Allows an administrator to create a new user', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const newUser = {
        username: 'a-new-user',
        password: 'super-secret',
      }
      const req1 = new Request({
        body: {
          grant_type: 'password',
          ...newUser,
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(401)
      expect(res1.$body.errors).toBeInstanceOf(Array)

      const req2 = new Request({
        accessToken,
        body: {
          data: {
            type: 'base$user',
            attributes: {
              accessLevel: 'user',
              ...newUser,
            },
          },
        },
        contentType: 'jsonApi',
        method: 'post',
        url: '/base$users',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(201)
      expect(res2.$body.data.length).toBe(1)
      expect(res2.$body.data[0].type).toBe('base$user')
      expect(typeof res2.$body.data[0].id).toBe('string')
      expect(res2.$body.data[0].attributes.accessLevel).toBe('user')
      expect(res2.$body.data[0].attributes.username).toBe(newUser.username)
      expect(res2.$body.data[0].attributes.password).not.toBeDefined()

      const req3 = new Request({
        body: {
          grant_type: 'password',
          ...newUser,
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(typeof res3.$body.access_token).toBe('string')
      expect(typeof res3.$body.expires_in).toBe('number')
      expect(res3.$body.token_type).toBe('bearer')
      expect(res3.contentType).toBe('application/json')
      expect(res3.statusCode).toBe(200)
      expect(typeof res3.headers['Set-Cookie']).toBe('string')
      expect(
        /^refresh_token=(.*)HttpOnly$/.test(res3.headers['Set-Cookie'])
      ).toBe(true)
    })

    test('Returns an error if a non-admin user tries to create a user', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user',
        password: 'baseplate',
      })
      const newUser = {
        username: 'unlucky-user',
        password: 'super-secret',
      }
      const req1 = new Request({
        accessToken,
        body: {
          data: {
            type: 'base$user',
            attributes: {
              accessLevel: 'user',
              ...newUser,
            },
          },
        },
        contentType: 'jsonApi',
        method: 'post',
        url: '/base$users',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(403)

      const req2 = new Request({
        body: {
          grant_type: 'password',
          ...newUser,
        },
        method: 'post',
        url: '/base$users/token',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(401)
      expect(res2.$body.errors).toBeInstanceOf(Array)
    })

    test('Returns the authenticated user', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-user',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/base$users/me',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.$body.data.type).toBe('base$user')
      expect(typeof res.$body.data.id).toBe('string')
      expect(res.$body.data.attributes.accessLevel).toBe('user')
      expect(res.$body.data.attributes.username).toBe('baseplate-user')
      expect(res.$body.data.attributes.password).not.toBeDefined()
    })

    describe('Returns a list of users', () => {
      test('Shows all users if the requesting user is an admin', async () => {
        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-admin',
          password: 'baseplate',
        })
        const newUser = {
          username: 'yet-another-user',
          password: 'super-secret',
        }
        const req1 = new Request({
          accessToken,
          body: {
            data: {
              type: 'base$user',
              attributes: {
                accessLevel: 'user',
                ...newUser,
              },
            },
          },
          contentType: 'jsonApi',
          method: 'post',
          url: '/base$users',
        })
        const res1 = new Response()

        await app.routesRest.handler(req1, res1)

        const req2 = new Request({
          accessToken,
          method: 'get',
          url: '/base$users',
        })
        const res2 = new Response()

        await app.routesRest.handler(req2, res2)

        expect(res2.statusCode).toBe(200)
        expect(res2.$body.data).toBeInstanceOf(Array)

        const createdUser = res2.$body.data.find(
          (item: any) => item.attributes.username === newUser.username
        )

        expect(typeof createdUser.id).toBe('string')
        expect(createdUser.attributes.accessLevel).toBe('user')
        expect(createdUser.attributes.username).toBe(newUser.username)
        expect(createdUser.attributes.password).not.toBeDefined()
      })

      test('Shows just the requesting client if they are not an admin', async () => {
        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-user',
          password: 'baseplate',
        })
        const req = new Request({
          accessToken,
          method: 'get',
          url: '/base$users',
        })
        const res = new Response()

        await app.routesRest.handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.$body.data.length).toBe(1)
        expect(res.$body.data[0].attributes.username).toBe('baseplate-user')
      })
    })

    describe('Granting access to resources', () => {
      test('Allows an admin user to grant a user access to a resource', async () => {
        const author = {
          firstName: 'José',
          lastName: 'Saramago',
        }
        const authors = await createEntries('author', app, [author])
        const user = await createUser({
          accessLevel: 'user',
          app,
          username: 'baseplate-user2',
          password: 'baseplate',
        })
        const accessToken1 = await getAccessToken({
          app,
          username: 'baseplate-admin',
          password: 'baseplate',
        })
        const accessToken2 = await getAccessToken({
          app,
          username: 'baseplate-user2',
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
        expect(res2.$body.data[0].relationships.user.data.type).toBe(
          'base$user'
        )
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

        await wipeModels(['author', 'base$access'], app)
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
          username: 'baseplate-user3',
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
          username: 'baseplate-user4',
          password: 'baseplate',
        })
        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-user3',
          password: 'baseplate',
        })
        const req1 = new Request({
          accessToken,
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
          accessToken,
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
          url: '/base$models/author/access',
        })
        const res2 = new Response()

        await app.routesRest.handler(req2, res2)

        expect(res2.statusCode).toBe(403)

        await wipeModels(['author', 'base$access'], app)
      })
    })

    describe('Updating user access to resources', () => {
      test("Allows an admin user to update a user's access to a resource", async () => {
        const author = {
          firstName: 'José',
          lastName: 'Saramago',
        }
        const authors = await createEntries('author', app, [author])
        const user = await createUser({
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
        const accessToken1 = await getAccessToken({
          app,
          username: 'baseplate-admin',
          password: 'baseplate',
        })
        const accessToken2 = await getAccessToken({
          app,
          username: 'baseplate-user5',
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

        await wipeModels(['author', 'base$access'], app)
      })

      test.only("Returns an error if a non-admin user tries to update another user's access to a resource", async () => {
        const author = {
          firstName: 'José',
          lastName: 'Saramago',
        }

        await createUser({
          accessLevel: 'user',
          app,
          username: 'baseplate-user7',
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
          username: 'baseplate-user8',
          password: 'baseplate',
          permissions: {
            author: {
              read: true,
            },
          },
        })
        const accessToken1 = await getAccessToken({
          app,
          username: 'baseplate-user7',
          password: 'baseplate',
        })
        const accessToken2 = await getAccessToken({
          app,
          username: 'baseplate-user8',
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
      })
    })
  })
})
