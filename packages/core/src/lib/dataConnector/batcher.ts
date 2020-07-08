import {FindOneByIdParameters} from './interface'
import Context from '../context'

const cachedPromise = Promise.resolve()

interface DataConnectorBatchItem {
  parameter: string
  resolve: Function
  reject: Function
}

export default class DataConnectorBatcher {
  static findOneById(
    props: FindOneByIdParameters,
    context: Context,
    combiner: Function
  ) {
    return new Promise((resolve, reject) => {
      const key =
        'base$batcher/' +
        JSON.stringify({
          fieldSet: props.fieldSet,
          filter: props.filter,
        })
      const existingBatch: DataConnectorBatchItem[] = context.get(key)

      if (existingBatch) {
        existingBatch.push({parameter: props.id, resolve, reject})

        return
      }

      const newBatch: DataConnectorBatchItem[] = [
        {
          parameter: props.id,
          resolve,
          reject,
        },
      ]

      context.set(key, newBatch)

      cachedPromise.then(() => {
        process.nextTick(async () => {
          const batch: DataConnectorBatchItem[] = context.get(key)
          const parameters = batch.map(({parameter}) => parameter)

          try {
            const result = combiner(parameters)

            batch.forEach(({resolve}) => resolve(result))
          } catch (error) {
            batch.forEach(({reject}) => reject(error))
          }
        })
      })
    })
  }
}
