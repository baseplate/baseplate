class EntryNotFoundError extends Error {
  constructor({id}) {
    super('Entry not found')

    this.detail = `Entry with ID \`${id}\` was not found`
    this.statusCode = 404
  }
}

class EntryFieldNotFoundError extends Error {
  constructor({fieldName, modelName}) {
    super('Invalid attribute in model')

    this.detail = `The model \`${modelName}\` does not have an attribute named \`${fieldName}\``
    this.statusCode = 404
  }
}

class ForbiddenError extends Error {
  constructor() {
    super('Forbidden')

    this.statusCode = 403
  }
}

class InvalidFieldTypeError extends Error {
  constructor({typeName}) {
    super(`${typeName} is not a valid type`)
  }
}

class InvalidQueryFilterError extends Error {
  constructor({fieldErrors} = {}) {
    super('Invalid query')

    this.childErrors = fieldErrors
    this.statusCode = 400
  }
}

class InvalidQueryFilterParameterError extends Error {
  constructor({path = [], value} = {}) {
    super('Invalid query parameter')

    this.path = path
    this.statusCode = 400
  }
}

class InvalidQueryParameterError extends Error {
  constructor({parameterName, value}) {
    super(`Invalid query parameter`)

    switch (parameterName) {
      case 'include':
        this.detail = `The resource does not have a \`${value}\` relationship path.`

        break

      default:
        this.detail = `\`${value}\` is not an accepted value for the \`${parameterName}\` parameter.`
    }

    this.statusCode = 400
  }
}

class InvalidRequestBodyError extends Error {
  constructor({expectedType}) {
    super(`Invalid request body`)

    this.detail = `The request body is not valid. Expected \`${expectedType}\`.`
    this.statusCode = 400
  }
}

class ModelNotFoundError extends Error {
  constructor({name}) {
    super('Model not found')

    this.detail = `Model named \`${name}\` was not found`
    this.statusCode = 404
  }
}

class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')

    this.statusCode = 401
  }
}

module.exports = {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ForbiddenError,
  InvalidFieldTypeError,
  InvalidQueryFilterError,
  InvalidQueryFilterParameterError,
  InvalidQueryParameterError,
  InvalidRequestBodyError,
  ModelNotFoundError,
  UnauthorizedError
}
