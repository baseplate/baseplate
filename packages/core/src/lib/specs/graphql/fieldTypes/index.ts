import GraphQLFieldArray from './array'
import GraphQLFieldBoolean from './boolean'
import GraphQLFieldMixed from './mixed'
import GraphQLFieldNumber from './number'
import GraphQLFieldReference from './reference'
import GraphQLFieldString from './string'

export default {
  primitives: {
    boolean: GraphQLFieldBoolean,
    mixed: GraphQLFieldMixed,
    number: GraphQLFieldNumber,
    string: GraphQLFieldString,
  },
  system: {
    array: GraphQLFieldArray,
    reference: GraphQLFieldReference,
  },
}

export type GraphQLField =
  | GraphQLFieldArray
  | GraphQLFieldBoolean
  | GraphQLFieldMixed
  | GraphQLFieldNumber
  | GraphQLFieldReference
  | GraphQLFieldString

export type GraphQLFieldHandler =
  | typeof GraphQLFieldArray
  | typeof GraphQLFieldBoolean
  | typeof GraphQLFieldMixed
  | typeof GraphQLFieldNumber
  | typeof GraphQLFieldReference
  | typeof GraphQLFieldString
