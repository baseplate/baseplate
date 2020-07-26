import type {App} from './dataConnectors'

export async function createEntries(
  modelHandle: string,
  app: App,
  items: any[]
) {
  const Model = app.modelStore.get(modelHandle)

  try {
    const entries = await Promise.all(
      items.map((item) => Model.create(item, {authenticate: false}))
    )

    return entries
  } catch (error) {
    console.log(error)
  }
}

export async function wipeModels(modelHandles: string[], app: App) {
  const selectedModels = app.modelStore
    .getAll()
    .filter((Model) => modelHandles.includes(Model.base$handle))

  await Promise.all(
    selectedModels.map((Model) => app.modelStore.dataConnector.wipe(Model))
  )
}
