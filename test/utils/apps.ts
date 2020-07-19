import * as mongoDBApp from '../../packages/db-mongodb/dist'

const apps = [['@baseplate/mongodb', mongoDBApp]]

export type App = typeof mongoDBApp

export function forEachApp(
  models: mongoDBApp.ModelDefinition[],
  callback: Function
) {
  describe.each(apps)('%s', (name: string, app: App) => {
    beforeAll(async () => {
      mongoDBApp.initialize(models, {
        database: {
          name: global.__MONGO_DB_NAME__,
          uri: global.__MONGO_URI__,
        },
      })

      await Promise.all(
        app.modelStore.getAll().map((Model) => Model.base$sync())
      )
    })

    afterAll(async () => {
      await Promise.all(
        app.modelStore
          .getAll()
          .map((Model) => app.modelStore.dataConnector.wipe(Model))
      )
      await app.modelStore.dataConnector.disconnect()
    })

    callback(app)
  })
}
