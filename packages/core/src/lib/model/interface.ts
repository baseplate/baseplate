import {FieldSetType} from '../fieldSet'
import Context from '../context'
import ModelDefinition from './definition'
import ModelStore from '../modelStore/base'
import QueryFilter from '../queryFilter'
import SortObject from '../sortObject'
import UserModel from '../models/user'

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

  static base$dbCreateOne(entry: Result): Result {
    return
  }

  static base$dbDelete(filter: QueryFilter): Promise<{deleteCount: number}> {
    return
  }

  static base$dbDeleteOneById(id: string): Promise<{deleteCount: number}> {
    return
  }

  static base$dbFind(props: FindParameters): Result {
    return
  }

  static base$dbFindManyById(props: FindManyByIdParameters): Promise<Results> {
    return
  }

  static base$dbFindOneById(props: FindOneByIdParameters): Result {
    return
  }

  static base$dbUpdate(filter: QueryFilter, update: Result): Result {
    return
  }
}

export interface CreateParameters {
  authenticate?: boolean
  context?: Context
  user?: UserModel
}

export interface DeleteParameters {
  authenticate?: boolean
  context?: Context
  filter: QueryFilter
  user?: UserModel
}

export interface DeleteOneByIdParameters {
  authenticate?: boolean
  context?: Context
  id: string
  user?: UserModel
}

export interface FindManyByIdParameters {
  authenticate?: Boolean
  context?: Context
  fieldSet: FieldSetType
  filter?: QueryFilter
  ids: Array<string>
  user?: UserModel
}

export interface FindOneByIdParameters {
  authenticate?: Boolean
  context?: Context
  fieldSet?: FieldSetType
  filter?: QueryFilter
  id: string
  user?: UserModel
}

export interface FindOneParameters {
  authenticate?: Boolean
  context: Context
  fieldSet: FieldSetType
  filter: QueryFilter
  user?: UserModel
}

export interface FindParameters {
  authenticate?: Boolean
  context?: Context
  fieldSet?: FieldSetType
  filter?: QueryFilter
  pageNumber?: number
  pageSize?: number
  sort?: SortObject
  user?: UserModel
}

export interface UpdateParameters {
  authenticate?: Boolean
  context?: Context
  filter: QueryFilter
  update: Record<string, any>
  user?: UserModel
}

export interface UpdateOneByIdParameters {
  authenticate?: Boolean
  context?: Context
  id: string
  update: Record<string, any>
  user?: UserModel
}
