export interface Field {
  children?: any
  cast({path, value}: {path: Array<string>; value: any}): any
  options: FieldOptions
  type: string
  subType?: string
  validate?({path, value}: {path: Array<string>; value: any}): any
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
