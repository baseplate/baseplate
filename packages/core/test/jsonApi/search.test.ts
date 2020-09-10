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

const articles = [
  {
    title: 'Stories Of The Toybox',
    body:
      'The red ball sat proudly at the top of the toybox. It had been the last to be played with and anticipated it would be the next as well. The other toys grumbled beneath. At one time each had held the spot of the red ball, but over time they had sunk deeper and deeper into the toy box.',
    wordCount: 59,
  },
  {
    title: 'The Red Ball',
    body:
      "It's always good to bring a slower friend with you on a hike. If you happen to come across bears, the whole group doesn't have to worry. Only the slowest in the group do. That was the lesson they were about to learn that day.",
    wordCount: 45,
  },
  {
    title: 'Some Dark Red',
    body:
      "She had been told time and time again that the most important steps were the first and the last. It was something that she carried within her in everything she did, but then he showed up and disrupted everything. He told her that she had it wrong. The first step wasn't the most important. The last step wasn't the most important. It was the next step that was the most important.\n\nI recollect that my first exploit in squirrel-shooting was in a grove of tall walnut-trees that shades one side of the valley. I had wandered into it at noontime, when all nature is peculiarly quiet, and was startled by the roar of my own gun, as it broke the Sabbath stillness around and was prolonged and reverberated by the angry echoes.",
    wordCount: 131,
  },
]

const comments = [
  {
    author: 'John Doe',
    body:
      "Hopes and dreams were dashed that day. It should have been expected, but it still came as a shock. The warning signs had been ignored in favor of the possibility, however remote, that it could actually happen. That possibility had grown from hope to an undeniable belief it must be destiny. That was until it wasn't and the hopes and dreams came crashing down.",
  },
  {
    author: 'Jane Doe',
    body: 'This was a shock!',
  },
  {
    author: 'Justin Case',
    body: 'Shock shock!',
  },
]

forEachDataConnector((app: App, loadModels: Function) => {
  const {BaseModel} = app

  let articleEntries: Record<string, any>[]
  let commentEntries: Record<string, any>[]

  describe('JSON:API – Searching resources', () => {
    beforeAll(async () => {
      await createUser({
        accessLevel: 'admin',
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })

      class Article extends BaseModel {
        static base$fields = {
          title: {
            search: {
              weight: 5,
            },
            type: String,
          },
          body: {
            search: {
              weight: 2,
            },
            type: String,
          },
          wordCount: Number,
        }
      }

      class Comment extends BaseModel {
        static base$fields = {
          author: {
            search: {
              weight: 1,
            },
            type: String,
          },
          body: {
            search: {
              weight: 8,
            },
            type: String,
          },
          article: 'Article',
        }
      }

      await loadModels([Article, Comment])

      articleEntries = await createEntries('article', app, articles)
      commentEntries = await createEntries('comment', app, [
        {...comments[0], article: articleEntries[0]},
        {...comments[1], article: articleEntries[1]},
        {...comments[2], article: articleEntries[2]},
      ])
    })

    afterAll(async () => {
      await wipeModels(['base$user', 'article', 'comment'], app)
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
        url: '/unicorns?search=rainbow',
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
          article: {
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
        url: '/articles?search=technology',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.statusCode).toBe(200)
      expect(res1.$body.data).toBeInstanceOf(Array)

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: '/comments?search=technology',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.statusCode).toBe(403)
      expect(res2.$body.errors).toBeInstanceOf(Array)
    })

    test('Returns a valid response when there are no resources that match the search criteria', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/articles?search=scrumptious',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(0)
      expect(res.$body.meta.count).toBe(0)
      expect(res.$body.links.self).toBe('/articles?search=scrumptious')
    })

    test('Returns a list of resources that match the search criteria, each with a numeric search score', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        method: 'get',
        url: '/articles?search=red',
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.$body.data.length).toBe(3)
      expect(res1.$body.data[0].id).toBe(articleEntries[1].id)
      expect(res1.$body.data[0].attributes.title).toBe(articles[1].title)
      expect(res1.$body.data[0].attributes.body).toBe(articles[1].body)
      expect(res1.$body.data[1].id).toBe(articleEntries[2].id)
      expect(res1.$body.data[1].attributes.title).toBe(articles[2].title)
      expect(res1.$body.data[1].attributes.body).toBe(articles[2].body)
      expect(res1.$body.data[2].id).toBe(articleEntries[0].id)
      expect(res1.$body.data[2].attributes.title).toBe(articles[0].title)
      expect(res1.$body.data[2].attributes.body).toBe(articles[0].body)
      expect(res1.$body.data[0].meta.searchScore).toBeGreaterThanOrEqual(
        res1.$body.data[1].meta.searchScore
      )
      expect(res1.$body.data[1].meta.searchScore).toBeGreaterThanOrEqual(
        res1.$body.data[2].meta.searchScore
      )

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: '/comments?search=shock',
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.$body.data.length).toBe(3)
      expect(res2.$body.data[0].id).toBe(commentEntries[2].id)
      expect(res2.$body.data[0].attributes.author).toBe(comments[2].author)
      expect(res2.$body.data[0].attributes.body).toBe(comments[2].body)
      expect(res2.$body.data[1].id).toBe(commentEntries[1].id)
      expect(res2.$body.data[1].attributes.author).toBe(comments[1].author)
      expect(res2.$body.data[1].attributes.body).toBe(comments[1].body)
      expect(res2.$body.data[2].id).toBe(commentEntries[0].id)
      expect(res2.$body.data[2].attributes.author).toBe(comments[0].author)
      expect(res2.$body.data[2].attributes.body).toBe(comments[0].body)
      expect(res2.$body.data[0].meta.searchScore).toBeGreaterThan(
        res2.$body.data[1].meta.searchScore
      )
      expect(res2.$body.data[1].meta.searchScore).toBeGreaterThan(
        res2.$body.data[2].meta.searchScore
      )

      const req3 = new Request({
        accessToken,
        method: 'get',
        url: '/articles?search=groups',
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)
    })

    test('Hides any items which the requesting client does not have read access to', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user2',
        password: 'baseplate',
        permissions: {
          article: {
            read: {
              filter: {
                title: {
                  _ne: 'The Red Ball',
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
        accessToken: accessToken,
        method: 'get',
        url: '/articles?search=red',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(2)

      expect(res.$body.data[0].id).toBe(articleEntries[2].id)
      expect(res.$body.data[0].attributes.title).toBe(articles[2].title)
      expect(res.$body.data[0].attributes.body).toBe(articles[2].body)
      expect(res.$body.data[1].id).toBe(articleEntries[0].id)
      expect(res.$body.data[1].attributes.title).toBe(articles[0].title)
      expect(res.$body.data[1].attributes.body).toBe(articles[0].body)
    })

    test('Respects pagination parameters and includes pagination links in the response', async () => {
      const urls = [
        '/articles?search=red&page[size]=1',
        '/articles?search=red&page[size]=1&page[number]=2',
        '/articles?search=red&page[size]=1&page[number]=3',
      ]
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req1 = new Request({
        accessToken,
        method: 'get',
        url: urls[0],
      })
      const res1 = new Response()

      await app.routesRest.handler(req1, res1)

      expect(res1.$body.data.length).toBe(1)
      expect(res1.$body.data[0].id).toBe(articleEntries[1].id)
      expect(res1.$body.links.self).toBe(urls[0])
      expect(res1.$body.links.next).toBe(urls[1])
      expect(res1.$body.links.prev).toBeUndefined()

      const req2 = new Request({
        accessToken,
        method: 'get',
        url: urls[1],
      })
      const res2 = new Response()

      await app.routesRest.handler(req2, res2)

      expect(res2.$body.data.length).toBe(1)
      expect(res2.$body.data[0].id).toBe(articleEntries[2].id)
      expect(res2.$body.links.self).toBe(urls[1])
      expect(res2.$body.links.next).toBe(urls[2])
      expect(res2.$body.links.prev).toBe(urls[0] + '&page[number]=1')

      const req3 = new Request({
        accessToken,
        method: 'get',
        url: urls[2],
      })
      const res3 = new Response()

      await app.routesRest.handler(req3, res3)

      expect(res3.$body.data.length).toBe(1)
      expect(res3.$body.data[0].id).toBe(articleEntries[0].id)
      expect(res3.$body.links.self).toBe(urls[2])
      expect(res3.$body.links.next).toBeUndefined()
      expect(res3.$body.links.prev).toBe(urls[1])

      expect(res1.$body.data[0].meta.searchScore).toBeGreaterThanOrEqual(
        res2.$body.data[0].meta.searchScore
      )
      expect(res2.$body.data[0].meta.searchScore).toBeGreaterThanOrEqual(
        res3.$body.data[0].meta.searchScore
      )
    })

    test('Respects a field projection', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/articles?search=red&fields[article]=body',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(3)
      expect(res.$body.data[0].id).toBe(articleEntries[1].id)
      expect(res.$body.data[0].attributes.title).toBeUndefined()
      expect(res.$body.data[0].attributes.body).toBe(articles[1].body)
      expect(res.$body.data[1].id).toBe(articleEntries[2].id)
      expect(res.$body.data[1].attributes.title).toBeUndefined()
      expect(res.$body.data[1].attributes.body).toBe(articles[2].body)
      expect(res.$body.data[2].id).toBe(articleEntries[0].id)
      expect(res.$body.data[2].attributes.title).toBeUndefined()
      expect(res.$body.data[2].attributes.body).toBe(articles[0].body)
    })

    test('Respects a query filter', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/articles?search=red&filter={"wordCount":{"$gt":100}}',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(1)
      expect(res.$body.data[0].id).toBe(articleEntries[2].id)
      expect(res.$body.data[0].attributes.title).toBe(articles[2].title)
      expect(res.$body.data[0].attributes.body).toBe(articles[2].body)
    })

    test('Includes referenced resources', async () => {
      const accessToken = await getAccessToken({
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
      const req = new Request({
        accessToken,
        method: 'get',
        url: '/comments?search=shock&include=article',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(3)

      expect(res.$body.data[0].id).toBe(commentEntries[2].id)
      expect(res.$body.data[0].attributes.author).toBe(comments[2].author)
      expect(res.$body.data[0].attributes.body).toBe(comments[2].body)
      expect(res.$body.data[0].relationships.article.data.type).toBe('article')
      expect(res.$body.data[0].relationships.article.data.id).toBe(
        articleEntries[2].id
      )
      expect(
        res.$body.included.find((item: any) => item.id === articleEntries[2].id)
      ).toBeTruthy()

      expect(res.$body.data[1].id).toBe(commentEntries[1].id)
      expect(res.$body.data[1].attributes.author).toBe(comments[1].author)
      expect(res.$body.data[1].attributes.body).toBe(comments[1].body)
      expect(res.$body.data[1].relationships.article.data.type).toBe('article')
      expect(res.$body.data[1].relationships.article.data.id).toBe(
        articleEntries[1].id
      )
      expect(
        res.$body.included.find((item: any) => item.id === articleEntries[1].id)
      ).toBeTruthy()

      expect(res.$body.data[2].id).toBe(commentEntries[0].id)
      expect(res.$body.data[2].attributes.author).toBe(comments[0].author)
      expect(res.$body.data[2].attributes.body).toBe(comments[0].body)
      expect(res.$body.data[2].relationships.article.data.type).toBe('article')
      expect(res.$body.data[2].relationships.article.data.id).toBe(
        articleEntries[0].id
      )
      expect(
        res.$body.included.find((item: any) => item.id === articleEntries[0].id)
      ).toBeTruthy()
    })

    test('Does not include referenced resources for which the requesting client does not have sufficient permissions for', async () => {
      await createUser({
        accessLevel: 'user',
        app,
        username: 'baseplate-user3',
        password: 'baseplate',
        permissions: {
          article: {
            read: {
              filter: {
                title: {
                  _ne: 'The Red Ball',
                },
              },
            },
          },
          comment: {
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
        url: '/comments?search=shock&include=article',
      })
      const res = new Response()

      await app.routesRest.handler(req, res)

      expect(res.$body.data.length).toBe(3)

      expect(res.$body.data[0].id).toBe(commentEntries[2].id)
      expect(res.$body.data[0].attributes.author).toBe(comments[2].author)
      expect(res.$body.data[0].attributes.body).toBe(comments[2].body)
      expect(res.$body.data[0].relationships.article.data.type).toBe('article')
      expect(res.$body.data[0].relationships.article.data.id).toBe(
        articleEntries[2].id
      )
      expect(
        res.$body.included.find((item: any) => item.id === articleEntries[2].id)
      ).toBeTruthy()

      expect(res.$body.data[1].id).toBe(commentEntries[1].id)
      expect(res.$body.data[1].attributes.author).toBe(comments[1].author)
      expect(res.$body.data[1].attributes.body).toBe(comments[1].body)
      expect(res.$body.data[1].relationships.article.data.type).toBe('article')
      expect(res.$body.data[1].relationships.article.data.id).toBe(
        articleEntries[1].id
      )
      expect(
        res.$body.included.find((item: any) => item.id === articleEntries[1].id)
      ).toBeFalsy()

      expect(res.$body.data[2].id).toBe(commentEntries[0].id)
      expect(res.$body.data[2].attributes.author).toBe(comments[0].author)
      expect(res.$body.data[2].attributes.body).toBe(comments[0].body)
      expect(res.$body.data[2].relationships.article.data.type).toBe('article')
      expect(res.$body.data[2].relationships.article.data.id).toBe(
        articleEntries[0].id
      )
      expect(
        res.$body.included.find((item: any) => item.id === articleEntries[0].id)
      ).toBeTruthy()
    })
  })
})
