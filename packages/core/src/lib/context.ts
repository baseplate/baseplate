import logger from './logger'

export default class Context extends Map<string, any> {
  constructor(initialData?: object) {
    super(initialData && Object.entries(initialData))
  }

  async getFromCacheOrOrigin<T>(origin: Function, key: string): Promise<T> {
    if (typeof origin !== 'function') {
      throw new Error('An origin function must be supplied')
    }

    const cacheKey = `base$cache/${key}`

    if (this.has(cacheKey)) {
      logger.debug('Retrieving from request context cache: %s', cacheKey)

      return this.get(cacheKey)
    }

    const dbOp = origin()

    this.set(cacheKey, dbOp)

    return await dbOp
  }
}
