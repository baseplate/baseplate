const FieldSet = require('../fieldSet')

const cachedPromise = Promise.resolve()

module.exports = DatabaseHandler =>
  class Batcher extends DatabaseHandler {
    static batch({combiner, context, getBatchingKey, props}) {
      return new Promise((resolve, reject) => {
        context.queue.push({
          getBatchingKey,
          props,
          reject,
          resolve
        })

        cachedPromise.then(() => {
          process.nextTick(() => {
            Batcher.processQueue(context.queue, combiner)

            context.queue = []
          })
        })
      })
    }

    static baseDB_find({context, ...props}) {
      if (!context) {
        return super.baseDB_find(props)
      }

      Batcher.populateContext(context)

      const cacheKey = JSON.stringify(props)

      if (context.cache.has(cacheKey)) {
        return context.cache.get(cacheKey)
      }

      const result = super.baseDB_find(props)

      context.cache.set(cacheKey, result)

      return result
    }

    static baseDB_findOneById({context, ...props}) {
      if (!context) {
        return super.baseDB_findOneById(props)
      }

      Batcher.populateContext(context)

      const cacheKey = JSON.stringify({
        id: props.id,
        fieldSet: props.fieldSet
      })

      if (context.cache.has(cacheKey)) {
        return context.cache.get(cacheKey)
      }

      const result = Batcher.batch({
        combiner: Batcher.findOneByIdCombiner.bind(this),
        context,
        getBatchingKey: props => props.modelName,
        props
      })

      context.cache.set(cacheKey, result)

      return result
    }

    static async findOneByIdCombiner(batch) {
      if (batch.length === 1) {
        const {fieldSet, filter, id} = batch[0].props
        const result = await super.baseDB_findOneById({
          fieldSet,
          filter,
          id
        })

        return [result]
      }

      // (!) TO DO: Handle case where ops have different filters.
      const fieldSet = batch.reduce((fieldSet, op) => {
        return FieldSet.unite(fieldSet, op.props.fieldSet)
      }, undefined)
      const ids = batch.map(op => op.props.id)
      const data = await super.baseDB_findManyById({
        fieldSet,
        ids
      })
      const results = batch.map(({props}) => {
        return data.find(({_id}) => _id === props.id) || null
      })

      return results
    }

    static populateContext(context) {
      context.cache = context.cache || new Map()
      context.queue = context.queue || []
    }

    static async processQueue(queue, handler) {
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
