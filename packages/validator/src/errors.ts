type Path = Array<string>

export abstract class CustomError extends Error {
  childErrors?: Array<CustomError>
  detail?: string
  path?: Path
  statusCode: number
  title: string
}

export class CastError extends CustomError {
  detail: string
  path: Path
  statusCode: number

  constructor({path, type, value}: {path: Path; type: string; value: any}) {
    const pathStr = path.join('.')
    const valueStr = value.toString()

    super(`Invalid ${pathStr}`)

    this.detail =
      valueStr === '[object Object]'
        ? `Value not accepted for attribute ${pathStr} (expected ${type})`
        : `${valueStr} is not an accepted value for attribute ${pathStr} (expected ${type})`
    this.path = path
    this.statusCode = 400
  }
}

export class EntryValidationError extends CustomError {
  childErrors: Array<CustomError>
  path: Path
  statusCode: number

  constructor({
    fieldErrors,
    path,
  }: {
    fieldErrors: Array<CustomError>
    path: Path
  }) {
    super('Entry validation error')

    this.childErrors = fieldErrors
    this.path = path
    this.statusCode = 400
  }
}

export class FieldValidationError extends CustomError {
  detail: string
  expected: string
  message: string
  path: Path
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
    path?: Path
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
