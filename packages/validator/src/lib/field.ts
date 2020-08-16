import {
  FieldIndexDefinition,
  getSchemaFields as getIndexSchemaFields,
} from './index'
import {Schema} from './schema'
import {validateObject} from './validator'

export interface BaseConstructorParameters {
  children: any
  options: BaseOptions
  path: Array<string>
  [propName: string]: any
}

export class BaseHandler {
  children: any
  options: BaseOptions
  path: string[]
  type: string

  constructor({children, options, path, type}: BaseConstructorParameters) {
    this.children = children
    this.options = options
    this.path = path
    this.type = type
  }

  static defaultOperators = {
    eq: {
      label: 'is',
    },
    in: {
      label: 'is one of',
    },
    ne: {
      label: 'is not',
    },
    nin: {
      label: 'is not one of',
    },
  }

  static operators: Operators

  static options: Record<string, any>

  cast({value}: CastParameters<any>) {
    return value
  }

  castQuery({path, value}: CastQueryParameters) {
    return value
  }

  validate({path, value}: ValidateParameters<any>) {}

  validateOptions() {
    const fields = {
      ...baseOptionsSchema,
      ...(<typeof BaseHandler>this.constructor).options,
    }

    this.options = validateObject({
      allowUnknownFields: true,
      enforceRequiredFields: false,
      object: this.options,
      path: this.path,
      schema: new Schema({fields}),
    })
  }
}

export interface BaseOptions {
  allowed?: Function
  default?: any
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

export const baseOptionsSchema = {
  allowed: {
    type: 'Mixed',
    validate: (input: any) => typeof input === 'function',
  },
  default: 'Mixed',
  errorMessage: String,
  get: {
    type: 'Mixed',
    validate: (input: any) => typeof input === 'function',
  },
  index: {
    type: 'Mixed',
    validate: (input: any) => {
      if (typeof input === 'boolean') return true

      const schema = new Schema(getIndexSchemaFields('field'))

      validateObject({object: input, schema})

      return true
    },
  },
  label: String,
  required: {
    type: 'Mixed',
    validate: (input: any) =>
      typeof input === 'function' || typeof input === 'boolean',
  },
  set: {
    type: 'Mixed',
    validate: (input: any) => typeof input === 'function',
  },
  unique: Boolean,
  validate: {
    type: 'Mixed',
    validate: (input: any) => typeof input === 'function',
  },
  type: {
    type: 'Mixed',
  },
}

export type BasicOrExtendedSchema =
  | Function
  | string
  | object
  | ExtendedSchema<Function | string | object>

export type CastParameters<T> = {
  path: string[]
  value: T
}

export type CastQueryParameters = {
  path: string[]
  value: any
}

export type ExtendedSchema<T> = {
  type: T
  [propName: string]: any
}

export interface NormalizedDefinition {
  children: any
  options: BaseOptions
  type: string
}

export interface Operator {
  label: string
}

export type Operators = Record<string, Operator>

export type RawDefinition =
  | object
  | BasicOrExtendedSchema
  | Array<BasicOrExtendedSchema>

export type ValidateParameters<T> = {
  path: string[]
  value: T
}
