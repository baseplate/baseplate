import {
  endpointStore,
  InitializationParameters,
  modelStore,
} from '@baseplate/core'

import PostgreSQL from './postgresql'

interface Options extends InitializationParameters {}

function initialize({endpoints = [], models = []}: Options) {
  const dataConnector = new PostgreSQL()

  endpointStore.load(endpoints)

  modelStore.setDataConnector(dataConnector)
  modelStore.load(models)
}

export * from '@baseplate/core'
export {initialize}
