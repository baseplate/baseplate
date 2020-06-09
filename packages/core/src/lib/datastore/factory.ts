import {batcherFactory} from './batcher'

console.log('FACTORY: Creating batcher')

export const DataStore = batcherFactory(global.$__baseDatastore)
