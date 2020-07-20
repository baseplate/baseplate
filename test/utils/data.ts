import type {App} from './apps'

export async function createEntries(
  modelHandle: string,
  app: App,
  items: any[]
) {
  const Model = app.modelStore.get(modelHandle)
  const entries = await Promise.all(
    items.map((item) => Model.create(item, {authenticate: false}))
  )

  return entries
}

export async function wipeModels(modelHandles: string[], app: App) {
  const selectedModels = app.modelStore
    .getAll()
    .filter((Model) => modelHandles.includes(Model.base$handle))

  await Promise.all(
    selectedModels.map((Model) => app.modelStore.dataConnector.wipe(Model))
  )
}
