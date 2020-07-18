import {ModelDefinition, modelStore} from '@baseplate/core'

import PostgreSQL from './postgresql'

const dataConnector = new PostgreSQL()

function initialize(models: ModelDefinition[]) {
  const dataConnector = new PostgreSQL()

  modelStore.setDataConnector(dataConnector)
  modelStore.reset()
  modelStore.load(models)
}

modelStore.setDataConnector(dataConnector)

export * from '@baseplate/core'
export {initialize}
