import ModelInterface, {
  FindOneByIdParameters,
  FindParameters,
} from './interface'
import Context from '../context'
import FieldSet, {FieldSetType} from '../fieldSet'

type ContextQueue = Array<BatchingOp>

export interface BatchingOp {
  getBatchingKey: Function
  props: FindOneByIdParameters
  reject: Function
  resolve: Function
}

const cachedPromise = Promise.resolve()

export const batcherFactory = (ModelWithDataStore: typeof ModelInterface) =>
  class ModelWithDataStoreAndBatcher extends ModelWithDataStore {
    static base$batcherAddBatch(
      combiner: Function,
      context: Context,
      getBatchingKey: Function,
      props: object
    ) {
      return new Promise((resolve, reject) => {
        context.queue.push({
          getBatchingKey,
          props,
          reject,
          resolve,
        })

        cachedPromise.then(() => {
          process.nextTick(() => {
            ModelWithDataStoreAndBatcher.base$batcherProcessBatchQueue(
              context.queue,
              combiner
            )

            context.queue = []
          })
        })
      })
    }

    static base$dbFind({context, ...props}: FindParameters) {
      if (!context) {
        return super.base$dbFind(props)
      }

      ModelWithDataStoreAndBatcher.base$batcherPopulateContext(context)

      const cacheKey = JSON.stringify(props)

      if (context.cache.has(cacheKey)) {
        return context.cache.get(cacheKey)
      }

      const result = super.base$dbFind(props)

      context.cache.set(cacheKey, result)

      return result
    }

    static base$dbFindOneById({context, ...props}: FindOneByIdParameters) {
      if (!context) {
        return super.base$dbFindOneById(props)
      }

      ModelWithDataStoreAndBatcher.base$batcherPopulateContext(context)

      const cacheKey = JSON.stringify({
        id: props.id,
        fieldSet: props.fieldSet,
      })

      if (context.cache.has(cacheKey)) {
        return context.cache.get(cacheKey)
      }

      const result = ModelWithDataStoreAndBatcher.base$batcherAddBatch(
        ModelWithDataStoreAndBatcher.base$dbFindOneByIdCombiner.bind(this),
        context,
        (props: any): string => props.modelName,
        props
      )

      context.cache.set(cacheKey, result)

      return result
    }

    static async base$dbFindOneByIdCombiner(batch: Array<BatchingOp>) {
      if (batch.length === 1) {
        const {fieldSet, filter, id} = batch[0].props
        const result = await super.base$dbFindOneById({
          fieldSet,
          filter,
          id,
        })

        return [result]
      }

      // (!) TO DO: Handle case where ops have different filters.
      const fieldSet = batch.reduce(
        (fieldSet: FieldSetType, op: BatchingOp) => {
          return FieldSet.unite(fieldSet, op.props.fieldSet)
        },
        undefined
      )
      const ids = batch.map((op: BatchingOp) => op.props.id)
      const data = await super.base$dbFindManyById({
        fieldSet,
        ids,
      })
      const results = batch.map(({props}) => {
        return data.find(({_id}: {_id: string}) => _id === props.id) || null
      })

      return results
    }

    static base$batcherPopulateContext(context: Context) {
      context.cache = context.cache || new Map()
      context.queue = context.queue || []
    }

    static async base$batcherProcessBatchQueue(
      queue: ContextQueue,
      handler: Function
    ) {
      const batches = queue.reduce(
        (batches: Record<string, Array<BatchingOp>>, op) => {
          const key = op.getBatchingKey(op.props)

          batches[key] = batches[key] || []
          batches[key].push(op)

          return batches
        },
        {}
      )

      await Promise.all(
        Object.values(batches).map(async (batch) => {
          try {
            const results = await handler(batch)

            batch.forEach((op, index) => {
              op.resolve(results[index])
            })
          } catch (error) {
            batch.forEach((op) => op.reject(error))
          }
        })
      )
    }
  }
