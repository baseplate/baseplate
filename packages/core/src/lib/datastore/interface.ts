import {FieldSetType} from '../fieldSet'
import QueryFilter from '../queryFilter'
import Schema from '../schema'
import SortObject from '../sortObject'

export abstract class DataStore {
  static isBaseModel: boolean
  static handle: string
  static handlePlural: string
  static schema: any
  static settings: {[key: string]: any}
  static store: object

  static $__dbCreateOne(entry: Record<string, any>): Record<string, any> {
    return
  }

  static $__dbDeleteOneById(id: string): {deleteCount: number} {
    return
  }

  static $__dbFind(props: FindParameters): Record<string, any> {
    return
  }

  static $__dbFindManyById(
    props: FindManyByIdParameters
  ): Array<Record<string, any>> {
    return
  }

  static $__dbFindOneById(props: FindOneByIdParameters): Record<string, any> {
    return
  }

  static $__dbUpdate(
    filter: QueryFilter,
    update: Record<string, any>
  ): Record<string, any> {
    return
  }
}

export interface DeleteOneByIdParameters {
  id: string
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
