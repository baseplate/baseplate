import {CustomError} from '@baseplate/validator'

export class EntryNotFoundError extends CustomError {
  detail: string
  statusCode: number

  constructor({id}: {id: string}) {
    super('Entry not found')

    this.detail = `Entry with ID \`${id}\` was not found`
    this.statusCode = 404
  }
}

export class EntryFieldNotFoundError extends CustomError {
  detail: string
  statusCode: number

  constructor({fieldName, modelName}: {fieldName: string; modelName: string}) {
    super('Invalid attribute in model')

    this.detail = `The model \`${modelName}\` does not have an attribute named \`${fieldName}\``
    this.statusCode = 404
  }
}

export class ForbiddenError extends CustomError {
  statusCode: number

  constructor() {
    super('Forbidden')

    this.statusCode = 403
  }
}

export class InvalidAccessValueError extends CustomError {
  detail: string
  path: Array<string>
  statusCode: number

  constructor({
    accessValue,
    path,
  }: {
    accessValue: string
    path?: Array<string>
  }) {
    super('Invalid access value')

    this.detail =
      'The value is not a valid access value. Expected a Boolean or an object with valid `filter` and/or `fields` properties'
    this.path = path
    this.statusCode = 400
  }
}

export class InvalidFieldSetError extends CustomError {
  detail: string
  statusCode: number

  constructor({fieldSet}: {fieldSet: Array<string>}) {
    super('Invalid field set')

    this.detail = `\`${fieldSet.toString()}\` is not a valid field set`
    this.statusCode = 400
  }
}

export class InvalidFieldTypeError extends CustomError {
  constructor({typeName}: {typeName: string}) {
    super(`${typeName} is not a valid type`)
  }
}

export class InvalidQueryFilterError extends CustomError {
  childErrors: Array<object>
  statusCode: number

  constructor({fieldErrors}: {fieldErrors?: Array<object>} = {}) {
    super('Invalid query')

    this.childErrors = fieldErrors
    this.statusCode = 400
  }
}

export class InvalidQueryFilterParameterError extends CustomError {
  path: Array<string>
  statusCode: number

  constructor({path = []}: {path?: Array<string>} = {}) {
    super('Invalid query parameter')

    this.path = path
    this.statusCode = 400
  }
}

export class InvalidQueryParameterError extends CustomError {
  detail: string
  statusCode: number

  constructor({name, value}: {name: string; value: string}) {
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

export class InvalidRequestBodyError extends CustomError {
  detail: string
  statusCode: number

  constructor({expectedType}: {expectedType: string}) {
    super(`Invalid request body`)

    this.detail = `The request body is not valid. Expected \`${expectedType}\``
    this.statusCode = 400
  }
}

export class ModelNotFoundError extends CustomError {
  detail: string
  statusCode: number

  constructor({name}: {name: string}) {
    super('Model not found')

    this.detail = `Model named \`${name}\` was not found`
    this.statusCode = 404
  }
}

export class UnauthorizedError extends CustomError {
  statusCode: number

  constructor() {
    super('Unauthorized')

    this.statusCode = 401
  }
}
