import {AbstractDataStore} from '../lib/datastore/abstract'

declare global {
  namespace NodeJS {
    interface Global {
      $__baseDatastore: typeof AbstractDataStore
    }
  }
}
