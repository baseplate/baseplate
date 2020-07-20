import {InitializationParameters, modelStore} from '@baseplate/core'
import {Options as DataConnectorOptions, MongoDB} from './mongodb'

interface Options extends InitializationParameters {
  database?: DataConnectorOptions
}

function initialize({database, models}: Options) {
  const dataConnector = new MongoDB({
    name: database.name || process.env.MONGODB_DATABASE,
    uri: database.uri || process.env.MONGODB_URI,
  })

  modelStore.setDataConnector(dataConnector)
  modelStore.reset()
  modelStore.load(models)
}

export * from '@baseplate/core'
export {initialize}
