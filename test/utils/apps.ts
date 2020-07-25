import * as mongoDBApp from '../../packages/db-mongodb/dist'

const apps = [['@baseplate/mongodb', mongoDBApp]]

export type App = typeof mongoDBApp

export function forEachDataConnector(callback: Function) {
  describe.each(apps)('%s', (_, app: App) => {
    const loadModels = (models: any[]) => {
      const loadedModels = app.modelStore.load(models)

      return Promise.all(loadedModels.map((Model) => Model.base$sync()))
    }

    beforeAll(async () => {
      mongoDBApp.initialize({
        database: {
          name: global.__MONGO_DB_NAME__,
          uri: global.__MONGO_URI__,
        },
        models: [],
      })

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
    })

    callback(app, loadModels)
  })
}
