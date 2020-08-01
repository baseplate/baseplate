import type BaseModel from '../model/base'
import type Context from '../context'
import type FieldSet from '../fieldSet'
import type QueryFilter from '../queryFilter'
import type SortObject from '../sortObject'

export type Result = Record<string, any>
export type Results = Array<Result>

const cachedPromise = Promise.resolve()

interface DataConnectorBatchItem {
  parameter: string
  resolve: Function
  reject: Function
}

export abstract class DataConnector {
  static batchFindOneById(
    props: FindOneByIdParameters,
    Model: typeof BaseModel,
    context: Context,
    combiner: Function
  ) {
    return new Promise((resolve, reject) => {
      const key =
        'base$batcher/' +
        Model.base$handle +
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
            const results = await combiner(parameters)

            batch.forEach((batchItem) => {
              const batchItemResult =
                results.find(
                  (result: Result) => result._id === batchItem.parameter
                ) || null

              batchItem.resolve(batchItemResult)
            })
          } catch (error) {
            batch.forEach(({reject}) => reject(error))
          }
        })
      })
    })
  }

  abstract createOne(entry: Result, Model: typeof BaseModel): Promise<Result>

  abstract delete(
    filter: QueryFilter,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<{deleteCount: number}>

  abstract deleteOneById(
    id: string,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<{deleteCount: number}>

  disconnect?(): Promise<void>

  abstract find(
    props: FindParameters,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<FindReturnValue>

  abstract findManyById(
    props: FindManyByIdParameters,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<Results>

  abstract findOneById(
    props: FindOneByIdParameters,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<Result>

  abstract sync(Model: typeof BaseModel): Promise<void>

  abstract update(
    filter: QueryFilter,
    update: Result,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<Result>

  abstract updateOneById(
    id: string,
    update: Result,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<Result>

  wipe?(Model: typeof BaseModel): Promise<void>
}

export interface FindManyByIdParameters {
  fieldSet?: FieldSet
  filter?: QueryFilter
  ids: Array<string>
}

export interface FindOneByIdParameters {
  batch?: boolean
  fieldSet?: FieldSet
  filter?: QueryFilter
  id: string
}

export interface FindOneParameters {
  fieldSet: FieldSet
  filter: QueryFilter
}

export interface FindReturnValue {
  count: number
  results: Results
}

export interface FindParameters {
  fieldSet?: FieldSet
  filter?: QueryFilter
  pageNumber?: number
  pageSize?: number
  sort?: SortObject
}

export interface UpdateParameters {
  filter: QueryFilter
  update: Record<string, any>
}

export interface UpdateOneByIdParameters {
  id: string
  update: Record<string, any>
}
