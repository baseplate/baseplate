class CastError extends Error {
  constructor({path, type, value}) {
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

class EntryValidationError extends Error {
  constructor({fieldErrors, path}) {
    super('Entry validation error')

    this.childErrors = fieldErrors
    this.path = path
    this.statusCode = 400
  }
}

class FieldValidationError extends Error {
  constructor({
    detail,
    expected,
    message = 'Validation error',
    path = [],
    type
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

module.exports = {
  CastError,
  EntryValidationError,
  FieldValidationError
}
