import {
  endpointStore,
  InitializationParameters,
  modelStore,
} from '@baseplate/core'

import {Options as DataConnectorOptions, PostgreSQL} from './postgresql'

interface Options extends InitializationParameters {
  database?: DataConnectorOptions
}

function initialize({database, endpoints = [], models = []}: Options) {
  const dataConnector = new PostgreSQL(database)

  endpointStore.load(endpoints)

  modelStore.setDataConnector(dataConnector)
  modelStore.load(models)
}

export * from '@baseplate/core'
export {initialize, PostgreSQL}
