import type {FieldSet, QueryFilter, SortObject} from '../../core/src'
import type BaseModel from '../../core/src/lib/model/base'
import type Context from '../../core/src/lib/context'

export type Result = Record<string, any>
export type Results = Array<Result>

export abstract class DataConnector {
  abstract base$dbCreateOne(entry: Result, model: typeof BaseModel): Result

  abstract base$dbDelete(
    filter: QueryFilter,
    model: typeof BaseModel,
    context?: Context
  ): Promise<{deleteCount: number}>

  abstract base$dbDeleteOneById(
    id: string,
    model: typeof BaseModel,
    context?: Context
  ): Promise<{deleteCount: number}>

  abstract base$dbFind(
    props: FindParameters,
    model: typeof BaseModel,
    context?: Context
  ): Result

  abstract base$dbFindManyById(
    props: FindManyByIdParameters,
    model: typeof BaseModel,
    context?: Context
  ): Promise<Results>

  abstract base$dbFindOneById(
    props: FindOneByIdParameters,
    model: typeof BaseModel,
    context?: Context
  ): Result

  abstract base$dbUpdate(
    filter: QueryFilter,
    update: Result,
    model: typeof BaseModel,
    context?: Context
  ): Result
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
