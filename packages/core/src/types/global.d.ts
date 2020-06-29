import ModelInterface from '../lib/model/interface'

declare global {
  namespace NodeJS {
    interface Global {
      base$baseDatastore: typeof ModelInterface
    }
  }
}
