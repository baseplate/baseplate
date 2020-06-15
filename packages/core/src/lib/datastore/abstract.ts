import {FieldSetType} from '../fieldSet'
import QueryFilter from '../queryFilter'
import SortObject from '../sortObject'

type Result = Record<string, any>
type Results = Array<Result>

export abstract class AbstractDataStore {
  static isBaseModel: boolean
  static handle: string
  static handlePlural: string
  static schema: any
  static settings: {[key: string]: any}
  static store: object

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
  fieldSet: FieldSetType
  filter?: QueryFilter
  ids: Array<string>
}

export interface FindOneByIdParameters {
  fieldSet: FieldSetType
  filter?: QueryFilter
  id: string
}

export interface FindParameters {
  fieldSet: FieldSetType
  filter?: QueryFilter
  pageNumber?: number
  pageSize?: number
  sort?: SortObject
}
