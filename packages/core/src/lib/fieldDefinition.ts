export type ExtendedSchema<T> = {
  type: T
  [propName: string]: any
}

export type BasicOrExtendedSchema =
  | Function
  | string
  | object
  | ExtendedSchema<Function | string | object>

export type FieldDefinition =
  | object
  | BasicOrExtendedSchema
  | Array<BasicOrExtendedSchema>
