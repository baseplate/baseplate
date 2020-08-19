import {types} from '@baseplate/schema'

import FieldArray from './array'
import FieldBoolean from './boolean'
import FieldMixed from './mixed'
import FieldNumber from './number'
import FieldObject from './object'
import FieldReference from './reference'
import FieldString from './string'

export const primitives = {
  ...types.primitives,
  boolean: FieldBoolean,
  mixed: FieldMixed,
  number: FieldNumber,
  string: FieldString,
}

export const system = {
  ...types.system,
  array: FieldArray,
  object: FieldObject,
  reference: FieldReference,
}
