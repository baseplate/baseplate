const FieldSet = require('../fieldSet')

const cachedPromise = Promise.resolve()

module.exports = DatabaseHandler =>
  class Batcher extends DatabaseHandler {
    constructor(...props) {
      super(...props)

      this.batchedOps = []
      this.cache = new Map()

      this.findOneByIdBatchCombiner = this.findOneByIdBatchCombiner.bind(this)
    }

    batch({combiner, groupingProp, props}) {
      return new Promise((resolve, reject) => {
        this.batchedOps.push({
          groupingProp,
          props,
          reject,
          resolve
        })

        cachedPromise.then(() => {
          process.nextTick(() => {
            this.processBatch(this.batchedOps, combiner)

            this.batchedOps = []
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
        combiner: this.findOneByIdBatchCombiner,
        groupingProp: 'modelName',
        props
      })

      this.cache.set(cacheKey, result)

      return result
    }

    async findOneByIdBatchCombiner(ops) {
      if (ops.length === 1) {
        const {fieldSet, filter, id, modelName} = ops[0].props
        const result = await super.findOneById({
          fieldSet,
          filter,
          id,
          modelName
        })

        return [result]
      }

      // (!) TO DO: Handle case where ops have different filters.
      const fieldSet = ops.reduce((fieldSet, op) => {
        return FieldSet.unite(fieldSet, op.props.fieldSet)
      }, undefined)
      const ids = ops.map(op => op.props.id)
      const data = await super.findManyById({
        fieldSet,
        ids,
        modelName: ops[0].props.modelName
      })
      const results = ops.map(({props}) => {
        return data.find(({_id}) => _id === props.id) || null
      })

      return results
    }

    async getUserAccess(props) {
      const cacheKey = JSON.stringify(props)

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)
      }

      const result = await super.getUserAccess(props)

      this.cache.set(cacheKey, result)

      return result
    }

    async processBatch(batch, handler) {
      const groupedOps = batch.reduce((ops, op) => {
        const key = op.props[op.groupingProp]

        ops[key] = ops[key] || []
        ops[key].push(op)

        return ops
      }, {})

      await Promise.all(
        Object.values(groupedOps).map(async ops => {
          try {
            const results = await handler(ops)

            ops.forEach((op, index) => {
              op.resolve(results[index])
            })
          } catch (error) {
            ops.forEach(op => op.reject(error))
          }
        })
      )
    }
  }
