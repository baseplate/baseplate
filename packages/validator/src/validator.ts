import {primitives as primitiveTypes, system as systemTypes} from './fieldTypes'
import {Field} from './field'
import {CustomError, EntryValidationError, FieldValidationError} from './errors'

type Schema = Record<string, Field>

interface ValidateFieldParameters {
  field: Field
  path: Array<string>
  value: any
}

interface ValidateObjectParameters {
  enforceRequiredFields?: boolean
  ignoreFields?: Array<string>
  object: any
  path?: Array<string>
  schema: Schema
  validateMetaFields?: boolean
}

export class Validator {
  static validateField({field, path, value}: ValidateFieldParameters) {
    const {options} = field

    if (typeof options.validate === 'function') {
      try {
        const validationResult = options.validate(value)

        if (validationResult !== undefined && !validationResult) {
          throw new Error('Validation failed')
        }
      } catch (error) {
        if (error instanceof FieldValidationError) {
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
      return Validator.validateObject({
        object: value,
        path,
        schema: field.children,
      })
    }

    let FieldClass

    switch (field.type) {
      case 'array':
        FieldClass = systemTypes.array

        break

      case 'primitive':
        const subType = <keyof typeof primitiveTypes>field.subType

        FieldClass = primitiveTypes[subType]

        break

      case 'reference':
        FieldClass = systemTypes.reference

        break
    }

    if (!FieldClass) {
      return value
    }

    const fieldHandler = new FieldClass({...field, path, validator: this})

    if (typeof fieldHandler.cast === 'function') {
      value = fieldHandler.cast({path, value})
    }

    if ('validate' in fieldHandler) {
      fieldHandler.validate({path, value})
    }

    return value
  }

  static validateObject({
    enforceRequiredFields = false,
    ignoreFields = [],
    object,
    path = [],
    schema,
    validateMetaFields = true,
  }: ValidateObjectParameters) {
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

        const field = schema[fieldName]

        if (!field) {
          fieldErrors.push(
            new FieldValidationError({
              path: path.concat(fieldName),
              type: 'NOT_IN_SCHEMA',
            })
          )

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
          const validatedValue = Validator.validateField({
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
      Object.entries(schema).forEach(([name, schema]) => {
        const {required} = schema.options || {}

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
}
