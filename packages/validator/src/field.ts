export interface Field {
  children?: any
  options: FieldOptions
  type: string
  subType?: string
}

export interface FieldConstructorParameters {
  path: Array<string>
  [propName: string]: any
}

export interface FieldOptions {
  allowed?: Function
  errorMessage?: string
  required?: boolean | Function
  validate?: Function
}
