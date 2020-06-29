import {batcherFactory} from './batcher'

const ModelInterfaceWithDataStore = batcherFactory(global.base$baseDatastore)

export default ModelInterfaceWithDataStore
