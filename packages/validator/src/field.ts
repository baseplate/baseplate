import {FieldOperators, FieldOptions} from './index'

export type CastParameters<T> = {
  path: string[]
  value: T
}

export abstract class FieldHandlerInterface {
  operators?: FieldOperators
  cast?({path, value}: CastParameters<any>): any
  validate?({path, value}: ValidateParameters<any>): any
}

export interface NormalizedField {
  children?: any
  options: FieldOptions
  type: string
  subType?: string
}

export type ValidateParameters<T> = {
  path: string[]
  value: T
}
