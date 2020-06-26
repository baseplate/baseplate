import {FieldSetType} from '../fieldSet'
import Context from '../context'
import ModelDefinition from './definition'
import ModelStore from '../modelStore/base'
import QueryFilter from '../queryFilter'
import SortObject from '../sortObject'

export type Result = Record<string, any>
export type Results = Array<Result>

export default abstract class ModelInterface extends ModelDefinition {
  static isBaseModel: boolean
  static handle: string
  static handlePlural: string
  static label?: string
  static schema: any
  static settings: {[key: string]: any}
  static store: ModelStore

  static $__dbCreateOne(entry: Result): Result {
    return
  }

  static $__dbDelete(filter: QueryFilter): Promise<{deleteCount: number}> {
    return
  }

  static $__dbDeleteOneById(id: string): Promise<{deleteCount: number}> {
    return
  }

  static $__dbFind(props: FindParameters): Result {
    return
  }

  static $__dbFindManyById(props: FindManyByIdParameters): Promise<Results> {
    return
  }

  static $__dbFindOneById(props: FindOneByIdParameters): Result {
    return
  }

  static $__dbUpdate(filter: QueryFilter, update: Result): Result {
    return
  }
}

export interface FindManyByIdParameters {
  context?: Context
  fieldSet: FieldSetType
  filter?: QueryFilter
  ids: Array<string>
}

export interface FindOneByIdParameters {
  context?: Context
  fieldSet?: FieldSetType
  filter?: QueryFilter
  id: string
}

export interface FindOneParameters {
  context: Context
  fieldSet: FieldSetType
  filter: QueryFilter
}

export interface FindParameters {
  context?: Context
  fieldSet?: FieldSetType
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
