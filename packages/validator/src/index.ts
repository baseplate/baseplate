import * as FieldArray from './types/array'
import * as FieldBoolean from './types/boolean'
import * as FieldMixed from './types/mixed'
import * as FieldNumber from './types/number'
import * as FieldObject from './types/object'
import * as FieldReference from './types/reference'
import * as FieldString from './types/string'

export const primitives = {
  boolean: FieldBoolean.FieldHandler,
  mixed: FieldMixed.FieldHandler,
  number: FieldNumber.FieldHandler,
  string: FieldString.FieldHandler,
}

export const system = {
  array: FieldArray.FieldHandler,
  reference: FieldReference.FieldHandler,
}

export type Field =
  | FieldArray.FieldHandler
  | FieldBoolean.FieldHandler
  | FieldMixed.FieldHandler
  | FieldNumber.FieldHandler
  | FieldReference.FieldHandler
  | FieldString.FieldHandler

export interface FieldConstructorParameters {
  path: Array<string>
  [propName: string]: any
}

export interface FieldDefinition {
  children?: any
  options: FieldOptions
  type: string
  subType?: string
}

export type FieldHandler =
  | typeof FieldArray.FieldHandler
  | typeof FieldBoolean.FieldHandler
  | typeof FieldMixed.FieldHandler
  | typeof FieldNumber.FieldHandler
  | typeof FieldReference.FieldHandler
  | typeof FieldString.FieldHandler

export type FieldIndexDefinition = boolean | FieldIndexDefinitionWithOptions

export type FieldIndexDefinitionWithOptions = {sparse: boolean}

export interface FieldOperator {
  label: string
}

export type FieldOperators = Record<string, FieldOperator>

export interface FieldOptions {
  allowed?: Function
  default?: boolean | Function
  errorMessage?: string
  get?: Function
  index?: FieldIndexDefinition
  label?: string
  required?: boolean | Function
  set?: Function
  unique?: boolean
  validate?: Function
  [optionName: string]: any
}

export {
  CastError,
  CustomError,
  EntryValidationError,
  FieldValidationError,
} from './errors'

export {
  FieldArray,
  FieldBoolean,
  FieldMixed,
  FieldNumber,
  FieldObject,
  FieldReference,
  FieldString,
}

export {Validator} from './validator'
