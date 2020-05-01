const FieldSet = require('../fieldSet')

const cachedPromise = Promise.resolve()

module.exports = DatabaseHandler =>
  class Batcher extends DatabaseHandler {
    constructor(...props) {
      super(...props)

      this.queue = []
      this.cache = new Map()
    }

    batch({combiner, getBatchingKey, props}) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          getBatchingKey,
          props,
          reject,
          resolve
        })

        cachedPromise.then(() => {
          process.nextTick(() => {
            this.processQueue(this.queue, combiner)

            this.queue = []
          })
        })
      })
    }

    find(props) {
      const cacheKey = JSON.stringify(props)

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)
      }

      const result = super.find(props)

      this.cache.set(cacheKey, result)

      return result
    }

    findOneById(props) {
      const cacheKey = JSON.stringify({
        id: props.id,
        fieldSet: props.fieldSet,
        modelName: props.modelName
      })

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)
      }

      const result = this.batch({
        combiner: async batch => {
          if (batch.length === 1) {
            const {fieldSet, filter, id, modelName} = batch[0].props
            const result = await super.findOneById({
              fieldSet,
              filter,
              id,
              modelName
            })

            return [result]
          }

          // (!) TO DO: Handle case where ops have different filters.
          const fieldSet = batch.reduce((fieldSet, op) => {
            return FieldSet.unite(fieldSet, op.props.fieldSet)
          }, undefined)
          const ids = batch.map(op => op.props.id)
          const data = await super.findManyById({
            fieldSet,
            ids,
            modelName: batch[0].props.modelName
          })
          const results = batch.map(({props}) => {
            return data.find(({_id}) => _id === props.id) || null
          })

          return results
        },
        getBatchingKey: props => props.modelName,
        props
      })

      this.cache.set(cacheKey, result)

      return result
    }

    async getUserAccess({includePublicUser, user}) {
      const props = {
        includePublicUser,
        user: user && {
          id: user.id,
          modelName: user.constructor.name
        }
      }
      const cacheKey = JSON.stringify(props)

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)
      }

      const result = this.batch({
        combiner: async ops => {
          const userAccess = await super.getUserAccess(ops[0].props)

          return [userAccess]
        },
        getBatchingKey: JSON.stringify,
        props
      })

      this.cache.set(cacheKey, result)

      return result
    }

    async processQueue(queue, handler) {
      const batches = queue.reduce((batches, op) => {
        const key = op.getBatchingKey(op.props)

        batches[key] = batches[key] || []
        batches[key].push(op)

        return batches
      }, {})

      await Promise.all(
        Object.values(batches).map(async batch => {
          try {
            const results = await handler(batch)

            batch.forEach((op, index) => {
              op.resolve(results[index])
            })
          } catch (error) {
            batch.forEach(op => op.reject(error))
          }
        })
      )
    }
  }
