const {CustomError} = require('../../validator/errors')

class EntryNotFoundError extends CustomError {
  constructor({id}) {
    super('Entry not found')

    this.detail = `Entry with ID \`${id}\` was not found`
    this.statusCode = 404
  }
}

class EntryFieldNotFoundError extends CustomError {
  constructor({fieldName, modelName}) {
    super('Invalid attribute in model')

    this.detail = `The model \`${modelName}\` does not have an attribute named \`${fieldName}\``
    this.statusCode = 404
  }
}

class ForbiddenError extends CustomError {
  constructor() {
    super('Forbidden')

    this.statusCode = 403
  }
}

class InvalidAccessValueError extends CustomError {
  constructor({accessValue, path}) {
    super('Invalid access value')

    this.detail =
      'The value is not a valid access value. Expected a Boolean or an object with valid `filter` and/or `fields` properties'
    this.path = path
    this.statusCode = 400
  }
}

class InvalidFieldSetError extends CustomError {
  constructor({fieldSet}) {
    super('Invalid field set')

    this.detail = `\`${fieldSet.toString()}\` is not a valid field set`
    this.statusCode = 400
  }
}

class InvalidFieldTypeError extends CustomError {
  constructor({typeName}) {
    super(`${typeName} is not a valid type`)
  }
}

class InvalidQueryFilterError extends CustomError {
  constructor({fieldErrors} = {}) {
    super('Invalid query')

    this.childErrors = fieldErrors
    this.statusCode = 400
  }
}

class InvalidQueryFilterParameterError extends CustomError {
  constructor({path = [], value} = {}) {
    super('Invalid query parameter')

    this.path = path
    this.statusCode = 400
  }
}

class InvalidQueryParameterError extends CustomError {
  constructor({name, value}) {
    super(`Invalid query parameter`)

    switch (name) {
      case 'include':
        this.detail = `The resource does not have a \`${value}\` relationship path`

        break

      default:
        this.detail = `\`${value}\` is not an accepted value for the \`${name}\` parameter`
    }

    this.statusCode = 400
  }
}

class InvalidRequestBodyError extends CustomError {
  constructor({expectedType}) {
    super(`Invalid request body`)

    this.detail = `The request body is not valid. Expected \`${expectedType}\``
    this.statusCode = 400
  }
}

class ModelNotFoundError extends CustomError {
  constructor({name}) {
    super('Model not found')

    this.detail = `Model named \`${name}\` was not found`
    this.statusCode = 404
  }
}

class UnauthorizedError extends CustomError {
  constructor() {
    super('Unauthorized')

    this.statusCode = 401
  }
}

module.exports = {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ForbiddenError,
  InvalidAccessValueError,
  InvalidFieldSetError,
  InvalidFieldTypeError,
  InvalidQueryFilterError,
  InvalidQueryFilterParameterError,
  InvalidQueryParameterError,
  InvalidRequestBodyError,
  ModelNotFoundError,
  UnauthorizedError
}
