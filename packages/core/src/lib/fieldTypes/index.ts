import FieldArray from './array'
import FieldBoolean from './boolean'
import FieldMixed from './mixed'
import FieldNumber from './number'
import FieldReference from './reference'
import FieldString from './string'

export default {
  primitives: {
    boolean: FieldBoolean,
    mixed: FieldMixed,
    number: FieldNumber,
    string: FieldString,
  },
  system: {
    array: FieldArray,
    reference: FieldReference,
  },
}

export type FieldHandler =
  | FieldArray
  | FieldBoolean
  | FieldMixed
  | FieldNumber
  | FieldReference
  | FieldString

export type FieldType =
  | typeof FieldArray
  | typeof FieldBoolean
  | typeof FieldMixed
  | typeof FieldNumber
  | typeof FieldReference
  | typeof FieldString
