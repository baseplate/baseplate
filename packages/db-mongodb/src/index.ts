import {
  endpointStore,
  InitializationParameters,
  modelStore,
} from '@baseplate/core'
import {Options as DataConnectorOptions, MongoDB} from './mongodb'

interface Options extends InitializationParameters {
  database?: DataConnectorOptions
}

function initialize({database, endpoints = [], models = []}: Options) {
  const dataConnector = new MongoDB({
    name: database.name || process.env.MONGODB_DATABASE,
    uri: database.uri || process.env.MONGODB_URI,
  })

  endpointStore.load(endpoints)

  modelStore.setDataConnector(dataConnector)
  modelStore.load(models)
}

export * from '@baseplate/core'
export {initialize}
