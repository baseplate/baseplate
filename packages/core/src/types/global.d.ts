import {DataStore} from '../lib/datastore/interface'

declare global {
  namespace NodeJS {
    interface Global {
      $__baseDatastore: typeof DataStore
    }
  }
}
