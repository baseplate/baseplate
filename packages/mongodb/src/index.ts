import {ModelDefinition, modelStore} from '@baseplate/core'
import {Options as DataConnectorOptions, MongoDB} from './mongodb'

interface Options {
  database?: DataConnectorOptions
}

function initialize(models: ModelDefinition[], options?: Options) {
  const {database} = options || {}
  const dataConnector = new MongoDB({
    name: database.name || process.env.MONGODB_DATABASE,
    uri: database.uri || process.env.MONGODB_URI,
  })

  modelStore.reset()
  modelStore.load(models)
  modelStore.setDataConnector(dataConnector)
}

export * from '@baseplate/core'
export {initialize}
