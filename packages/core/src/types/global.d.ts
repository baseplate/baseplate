import ModelInterface from '../lib/model/interface'

declare global {
  namespace NodeJS {
    interface Global {
      $__baseDatastore: typeof ModelInterface
    }
  }
}
