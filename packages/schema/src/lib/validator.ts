import type {BaseHandler} from './field'
import {CustomError, EntryValidationError, FieldValidationError} from './errors'
import {isPlainObject} from './utils'
import type {Schema} from './schema'

interface ValidateFieldParameters {
  field: BaseHandler
  path: Array<string>
  value: any
}

export function validateField({field, path, value}: ValidateFieldParameters) {
  const {options} = field

  if (typeof options.validate === 'function') {
    try {
      const validationResult = options.validate(value)

      if (validationResult !== undefined && !validationResult) {
        throw new Error('Validation failed')
      }
    } catch (error) {
      if (error instanceof CustomError) {
        throw error
      }

      throw new FieldValidationError({
        message:
          typeof options.errorMessage === 'string'
            ? options.errorMessage
            : undefined,
        path,
      })
    }
  }

  if (field.type === 'object') {
    return validateObject({
      object: value,
      path,
      schema: field.children,
    })
  }

  if (typeof field.cast === 'function') {
    value = field.cast({path, value})
  }

  return value
}

interface ValidateObjectParameters {
  allowUnknownFields?: boolean
  enforceRequiredFields?: boolean
  ignoreFields?: Array<string>
  object: any
  path?: Array<string>
  schema: Schema
  validateMetaFields?: boolean
}

export function validateObject({
  allowUnknownFields = false,
  enforceRequiredFields = true,
  ignoreFields = [],
  object,
  path = [],
  schema,
  validateMetaFields = true,
}: ValidateObjectParameters) {
  if (!isPlainObject(object)) {
    throw new EntryValidationError({path})
  }

  const fieldErrors: Array<CustomError> = []

  // Looking for fields that are in the object but shouldn't be or don't have
  // the right format.
  const validatedObject: any = Object.keys(object).reduce(
    (result, fieldName) => {
      if (
        fieldName === '_id' ||
        ignoreFields.includes(fieldName) ||
        (fieldName[0] === '_' && !validateMetaFields) ||
        object[fieldName] === undefined
      ) {
        return result
      }

      const field = schema.handlers[fieldName]

      if (!field) {
        if (!allowUnknownFields) {
          fieldErrors.push(
            new FieldValidationError({
              path: path.concat(fieldName),
              type: 'NOT_IN_SCHEMA',
            })
          )
        }

        return result
      }

      if (field.options && field.options.allowed !== undefined) {
        const isAllowed =
          typeof field.options.allowed === 'function'
            ? field.options.allowed(object)
            : Boolean(field.options.allowed)

        if (!isAllowed) {
          fieldErrors.push(
            new FieldValidationError({
              path: path.concat(fieldName),
              type: 'NOT_IN_SCHEMA',
            })
          )

          return result
        }
      }

      try {
        const validatedValue = validateField({
          field,
          path: path.concat(fieldName),
          value: object[fieldName],
        })

        return {
          ...result,
          [fieldName]: validatedValue,
        }
      } catch (error) {
        fieldErrors.push(error)
      }

      return result
    },
    {}
  )

  if (enforceRequiredFields) {
    // Looking for fields that should be in the object but are not.
    Object.entries(schema.fields).forEach(([name, field]) => {
      const {required} = field.options || {}

      if (required && object[name] === undefined) {
        const isRequired =
          typeof required === 'function' ? required(object) : required

        if (isRequired) {
          fieldErrors.push(
            new FieldValidationError({
              path: path.concat(name),
              type: 'REQUIRED',
            })
          )
        }
      }
    })
  }

  if (fieldErrors.length > 0) {
    throw new EntryValidationError({fieldErrors, path})
  }

  return validatedObject
}
