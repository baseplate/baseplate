import * as FieldArray from './array'
import * as FieldBoolean from './boolean'
import * as FieldMixed from './mixed'
import * as FieldNumber from './number'
import * as FieldObject from './object'
import * as FieldReference from './reference'
import * as FieldString from './string'

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

export {
  FieldArray as array,
  FieldBoolean as boolean,
  FieldMixed as mixed,
  FieldNumber as number,
  FieldObject as object,
  FieldReference as reference,
  FieldString as string,
}

export type Field =
  | FieldArray.FieldHandler
  | FieldBoolean.FieldHandler
  | FieldMixed.FieldHandler
  | FieldNumber.FieldHandler
  | FieldObject.FieldHandler
  | FieldReference.FieldHandler
  | FieldString.FieldHandler

export type FieldHandler =
  | typeof FieldArray.FieldHandler
  | typeof FieldBoolean.FieldHandler
  | typeof FieldMixed.FieldHandler
  | typeof FieldNumber.FieldHandler
  | typeof FieldReference.FieldHandler
  | typeof FieldString.FieldHandler
