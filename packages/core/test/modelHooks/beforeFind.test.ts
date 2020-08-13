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

  describe('Model Hooks: beforeFind', () => {
    beforeAll(async () => {
      await createUser({
        accessLevel: 'admin',
        app,
        username: 'baseplate-admin',
        password: 'baseplate',
      })
    })

    describe('GraphQL', () => {
      test("Runs before the model's `find` method when processing a request for finding a resource by ID", async () => {
        class Element extends BaseModel {
          static base$fields = {
            atomicNumber: Number,
            name: String,
          }

          static base$beforeFind(props: any) {
            expect(props.fieldSet).toBeInstanceOf(FieldSet)
            expect(props.fieldSet.has('name')).toBe(true)
            expect(props.fieldSet.has('_createdAt')).toBe(true)
            expect(props.fieldSet.has('_updatedAt')).toBe(true)
            expect(props.fieldSet.has('_id')).toBe(true)
            expect(props.filter).toBeInstanceOf(QueryFilter)

            return {
              filter: new QueryFilter({name: {$ne: 'Molybdenum'}}),
            }
          }
        }

        await loadModels([Element])

        const entries = await createEntries('element', app, [
          {atomicNumber: 42, name: 'Molybdenum'},
          {atomicNumber: 45, name: 'Rhodium'},
        ])
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
                Element(_id: "${entries[0].id}") {
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
        await wipeModels(['element'], app)

        expect(res.$body.data.Element._id).toBe(entries[1].id)
        expect(res.$body.data.Element.name).toEqual(entries[1].get('name'))
        expect(res.$body.data.Element.atomicNumber).toBeUndefined()
      })

      test("Runs before the model's `find` method when processing a request for listing a model's resources", async () => {
        class Element extends BaseModel {
          static base$fields = {
            atomicNumber: Number,
            name: String,
          }

          static base$beforeFind(props: any) {
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
              filter: new QueryFilter({name: {$ne: 'Molybdenum'}}),
            }
          }
        }

        await loadModels([Element])

        const entries = await createEntries('element', app, [
          {atomicNumber: 42, name: 'Molybdenum'},
          {atomicNumber: 45, name: 'Rhodium'},
        ])
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
        await wipeModels(['element'], app)

        expect(res.$body.data.Elements.length).toBe(1)
        expect(res.$body.data.Elements[0]._id).toBe(entries[1].id)
        expect(res.$body.data.Elements[0].name).toEqual(entries[1].get('name'))
        expect(res.$body.data.Elements[0].atomicNumber).toBeUndefined()
      })
    })

    describe('JSON:API', () => {
      test("Runs before the model's `find` method when processing a request for finding a resource by ID", async () => {
        class Element extends BaseModel {
          static base$fields = {
            atomicNumber: Number,
            name: String,
          }

          static base$beforeFind(props: any) {
            expect(props.fieldSet).toBeInstanceOf(FieldSet)
            expect(props.fieldSet.has('atomicNumber')).toBe(false)
            expect(props.fieldSet.has('name')).toBe(true)
            expect(props.fieldSet.has('_createdAt')).toBe(true)
            expect(props.fieldSet.has('_updatedAt')).toBe(true)
            expect(props.fieldSet.has('_id')).toBe(true)
            expect(props.filter).toBeInstanceOf(QueryFilter)

            return {
              filter: new QueryFilter({name: {$ne: 'Molybdenum'}}),
            }
          }
        }

        await loadModels([Element])

        const entries = await createEntries('element', app, [
          {atomicNumber: 42, name: 'Molybdenum'},
          {atomicNumber: 45, name: 'Rhodium'},
        ])
        const accessToken = await getAccessToken({
          app,
          username: 'baseplate-admin',
          password: 'baseplate',
        })
        const req = new Request({
          accessToken,
          method: 'get',
          url: `/elements/${entries[0].id}?fields[element]=name`,
        })
        const res = new Response()

        await app.routesRest.handler(req, res)
        await wipeModels(['element'], app)

        expect(res.statusCode).toBe(200)
        expect(res.$body.data.id).toBe(entries[1].id)
        expect(res.$body.data.attributes.name).toEqual(entries[1].get('name'))
        expect(res.$body.data.attributes.atomicNumber).toBeUndefined()
      })

      test("Runs before the model's `find` method when processing a request for listing a model's resources", async () => {
        class Element extends BaseModel {
          static base$fields = {
            atomicNumber: Number,
            name: String,
          }

          static base$beforeFind(props: any) {
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
              fieldSet: props.fieldSet.add('atomicNumber'),
              filter: new QueryFilter({name: {$ne: 'Molybdenum'}}),
            }
          }
        }

        await loadModels([Element])

        const entries = await createEntries('element', app, [
          {atomicNumber: 42, name: 'Molybdenum'},
          {atomicNumber: 45, name: 'Rhodium'},
        ])
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
        await wipeModels(['element'], app)

        expect(res.statusCode).toBe(200)
        expect(res.$body.data.length).toBe(1)
        expect(res.$body.data[0].id).toBe(entries[1].id)
        expect(res.$body.data[0].attributes.name).toEqual(
          entries[1].get('name')
        )
        expect(res.$body.data[0].attributes.atomicNumber).toBeUndefined()
      })
    })
  })
})
