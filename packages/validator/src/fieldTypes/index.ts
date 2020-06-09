import FieldArray from './array'
import FieldBoolean from './boolean'
import FieldMixed from './mixed'
import FieldNumber from './number'
import FieldObject from './object'
import FieldReference from './reference'
import FieldString from './string'

export const primitives = {
  boolean: FieldBoolean,
  mixed: FieldMixed,
  number: FieldNumber,
  string: FieldString,
}

export const system = {
  array: FieldArray,
  reference: FieldReference,
}

export type Field =
  | FieldArray
  | FieldBoolean
  | FieldMixed
  | FieldNumber
  | FieldObject
  | FieldReference
  | FieldString

export type FieldHandler =
  | typeof FieldArray
  | typeof FieldBoolean
  | typeof FieldMixed
  | typeof FieldNumber
  | typeof FieldReference
  | typeof FieldString
