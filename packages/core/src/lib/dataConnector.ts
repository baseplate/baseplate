import type BaseModel from './model/base'
import type Context from './context'
import type FieldSet from './fieldSet'
import type QueryFilter from './queryFilter'
import type SortObject from './sortObject'

export type Result = Record<string, any>
export type Results = Array<Result>

export abstract class DataConnector {
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

  abstract update(
    filter: QueryFilter,
    update: Result,
    Model: typeof BaseModel,
    context?: Context
  ): Promise<Result>
}

export interface FindManyByIdParameters {
  fieldSet: FieldSet
  filter?: QueryFilter
  ids: Array<string>
}

export interface FindOneByIdParameters {
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
