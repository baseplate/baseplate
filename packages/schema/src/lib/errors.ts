import {isPlainObject} from './utils'

export abstract class CustomError extends Error {
  childErrors?: Array<CustomError>
  detail?: string
  path?: string[]
  statusCode: number
  title: string
}

export class EntryValidationError extends CustomError {
  childErrors: Array<CustomError>
  path: string[]
  statusCode: number

  constructor({
    fieldErrors,
    path,
  }: {
    fieldErrors?: Array<CustomError>
    path: string[]
  }) {
    super('Entry validation error')

    this.detail = 'The value does not conform to the model schema'
    this.childErrors = fieldErrors
    this.path = path
    this.statusCode = 400
  }
}

export class FieldValidationError extends CustomError {
  detail: string
  expected: string
  message: string
  path: string[]
  statusCode: number
  type: string

  constructor({
    detail,
    expected,
    message = 'Validation error',
    path = [],
    type,
  }: {
    detail?: string
    expected?: string
    message?: string
    path?: string[]
    type?: string
  } = {}) {
    switch (type) {
      case 'INVALID_MEMBER':
        message = 'Invalid member'
        detail = `Value is not a valid member of ${path.join(
          '.'
        )} (expected ${expected})`

        break

      case 'NOT_IN_SCHEMA':
        message = 'Invalid field'
        detail = `Field ${path.join('.')} does not exist in the model`

        break

      case 'REQUIRED':
        message = 'Missing field'
        detail = `Value missing for required field ${path.join('.')}`

        break
    }

    super(message)

    this.detail = detail
    this.path = path
    this.statusCode = 400
    this.type = type
  }
}

export class InvalidFieldTypeError extends CustomError {
  constructor({typeName}: {typeName: string}) {
    super(`${typeName} is not a valid type`)
  }
}
