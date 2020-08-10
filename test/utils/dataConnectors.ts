import type {
  BaseModel,
  FieldSet,
  modelStore,
  QueryFilter,
  routesGraphQL,
  routesRest,
} from '../../packages/core/src'
import * as mongoDB from '../../packages/db-mongodb/src'
import * as postgreSQL from '../../packages/db-postgresql/src'

export type App = {
  BaseModel: typeof BaseModel
  FieldSet: typeof FieldSet
  initialize: Function
  modelStore: typeof modelStore
  QueryFilter: typeof QueryFilter
  routesGraphQL: typeof routesGraphQL
  routesRest: typeof routesRest
}

const apps: Array<[string, App]> = [
  ['@baseplate/mongodb', mongoDB],
  //['@baseplate/postgres', postgreSQL],
]

export function forEachDataConnector(callback: Function) {
  const postgresOptions = {
    database: `baseplate-test-${Math.random().toString(36).substring(7)}`,
  }
  const postgres = new postgreSQL.PostgreSQL(postgresOptions)

  describe.each(apps)('%s', (name: string, app: App) => {
    const loadModels = (models: any[]) => {
      const loadedModels = app.modelStore.load(models)

      return Promise.all(loadedModels.map((Model) => Model.base$sync()))
    }

    beforeAll(async () => {
      if (name === '@baseplate/mongodb') {
        mongoDB.initialize({
          database: {
            name: global.__MONGO_DB_NAME__,
            uri: global.__MONGO_URI__,
          },
          models: [],
        })
      }

      if (name === '@baseplate/postgres') {
        await postgres.createDatabase()

        postgreSQL.initialize({
          database: postgresOptions,
          models: [],
        })
      }

      await Promise.all(
        app.modelStore.getAll().map((Model) => Model.base$sync())
      )
    })

    afterAll(async () => {
      try {
        await Promise.all(
          app.modelStore
            .getAll()
            .map((Model) => app.modelStore.dataConnector.wipe(Model))
        )
      } catch {}

      await app.modelStore.dataConnector.disconnect()

      if (name === '@baseplate/postgres') {
        await postgres.deleteDatabase()
      }
    })

    callback(app, loadModels)
  })
}
