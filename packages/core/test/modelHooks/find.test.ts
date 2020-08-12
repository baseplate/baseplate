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

forEachDataConnector((app: App, loadModels: Function) => {
  const {BaseModel, FieldSet, QueryFilter} = app

  describe('Model Hooks: find', () => {
    beforeAll(async () => {
      await createUser({
        accessLevel: 'admin',
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
    })

    describe('GraphQL', () => {
      test("Runs before the model's `find` method, intercepting the operation parameters", async () => {
        const results = [
          {
            _id: '5f32601e92e2500d040041f0',
            atomicNumber: 107,
            name: 'Bohrium',
          },
          {
            _id: '5f32601e92e2500d040041f1',
            atomicNumber: 104,
            name: 'Rutherfordium',
          },
        ]

        class Element extends BaseModel {
          static base$fields = {
            atomicNumber: Number,
            name: String,
          }

          static async base$find(props: any): Promise<any> {
            expect(props.fieldSet).toBeInstanceOf(FieldSet)
            expect(props.fieldSet.has('name')).toBe(true)
            expect(props.fieldSet.has('_createdAt')).toBe(true)
            expect(props.fieldSet.has('_updatedAt')).toBe(true)
            expect(props.fieldSet.has('_id')).toBe(true)
            expect(props.filter).toBeInstanceOf(QueryFilter)
            expect(props.pageNumber).toBeUndefined()
            expect(typeof props.pageSize).toBe('number')
            expect(props.sort).toBeUndefined()

            return {
              count: 2,
              results,
            }
          }
        }

        await loadModels([Element])

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
                Elements {
                  _id
                  name
                }
              }
            `,
          },
          method: 'post',
          url: '/graphql',
        })
        const res = new Response()

        await app.routesGraphQL.handler(req, res)

        expect(res.$body.data.Elements.length).toBe(2)
        expect(res.$body.data.Elements[0]._id).toBe(results[0]._id)
        expect(res.$body.data.Elements[0].name).toEqual(results[0].name)
        expect(res.$body.data.Elements[0].atomicNumber).toBeUndefined()
        expect(res.$body.data.Elements[1]._id).toBe(results[1]._id)
        expect(res.$body.data.Elements[1].name).toEqual(results[1].name)
        expect(res.$body.data.Elements[1].atomicNumber).toBeUndefined()

        await wipeModels(['element'], app)
      })
    })

    describe('JSON:API', () => {
      test("Runs in place of the model's `find` method, returning the set of entries returned from the database", async () => {
        const results = [
          {
            _id: '5f32601e92e2500d040041f0',
            atomicNumber: 107,
            name: 'Bohrium',
          },
          {
            _id: '5f32601e92e2500d040041f1',
            atomicNumber: 104,
            name: 'Rutherfordium',
          },
        ]
        class Element extends BaseModel {
          static base$fields = {
            atomicNumber: Number,
            name: String,
          }

          static async base$find(props: any): Promise<any> {
            expect(props.fieldSet).toBeInstanceOf(FieldSet)
            expect(props.fieldSet.has('atomicNumber')).toBe(false)
            expect(props.fieldSet.has('name')).toBe(true)
            expect(props.fieldSet.has('_createdAt')).toBe(true)
            expect(props.fieldSet.has('_updatedAt')).toBe(true)
            expect(props.fieldSet.has('_id')).toBe(true)
            expect(props.filter).toBeInstanceOf(QueryFilter)
            expect(props.pageNumber).toBe(1)
            expect(props.pageSize).toBe(7)
            expect(props.sort).toEqual({name: 1})

            return {
              count: 2,
              results,
            }
          }
        }

        await loadModels([Element])

        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-admin',
          password: 'baseplate',
        })
        const req = new Request({
          accessToken,
          method: 'get',
          url:
            '/elements?page[size]=7&page[number]=1&sort=name&fields[element]=name',
        })
        const res = new Response()

        await app.routesRest.handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.$body.data.length).toBe(2)
        expect(res.$body.meta.count).toBe(2)
        expect(res.$body.data[0].id).toBe(results[0]._id)
        expect(res.$body.data[0].attributes.name).toEqual(results[0].name)
        expect(res.$body.data[0].attributes.atomicNumber).toBeUndefined()
        expect(res.$body.data[1].id).toBe(results[1]._id)
        expect(res.$body.data[1].attributes.name).toEqual(results[1].name)
        expect(res.$body.data[1].attributes.atomicNumber).toBeUndefined()

        await wipeModels(['element'], app)
      })
    })
  })
})
