import {
  endpointStore,
  InitializationParameters,
  modelStore,
} from '@baseplate/core'

import PostgreSQL from './postgresql'

interface Options extends InitializationParameters {}

const dataConnector = new PostgreSQL()

function initialize({endpoints = [], models = []}: Options) {
  const dataConnector = new PostgreSQL()

  endpointStore.load(endpoints)

  modelStore.setDataConnector(dataConnector)
  modelStore.reset()
  modelStore.load(models)
}

modelStore.setDataConnector(dataConnector)

export * from '@baseplate/core'
export {initialize}
