import FieldArray, {Options as FieldArrayOptions} from './array'
import FieldBoolean from './boolean'
import FieldMixed from './mixed'
import FieldNumber, {Options as FieldNumberOptions} from './number'
import FieldObject from './object'
import FieldReference from './reference'
import FieldString, {Options as FieldStringOptions} from './string'

export const primitives = {
  boolean: FieldBoolean,
  mixed: FieldMixed,
  number: FieldNumber,
  string: FieldString,
}

export const system = {
  array: FieldArray,
  object: FieldObject,
  reference: FieldReference,
}

export {
  FieldArray,
  FieldArrayOptions,
  FieldBoolean,
  FieldMixed,
  FieldNumber,
  FieldNumberOptions,
  FieldObject,
  FieldReference,
  FieldString,
  FieldStringOptions,
}
