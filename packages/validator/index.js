const {
  EntryValidationError,
  FieldValidationError,
  InvalidQueryFilterParameterError,
  InvalidQueryFilterError
} = require('./validation-errors')
const types = require('./fieldTypes')

const COMPARISON_OPERATORS = [
  '$eq',
  '$gt',
  '$gte',
  '$in',
  '$lt',
  '$lte',
  '$ne',
  '$nin'
]
const LOGICAL_OPERATORS = ['$and', '$not', '$nor', '$or']

class Validator {
  static validateField({field, path, value}) {
    const {options = {}} = field

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
          path
        })
      }
    }

    if (field.type === 'object') {
      return Validator.validateObject({
        object: value,
        path,
        schema: field.children
      })
    }

    let FieldClass

    switch (field.type) {
      case 'array':
        FieldClass = types.system.array

        break

      case 'primitive':
        FieldClass = types.primitives[field.subType]

        break

      case 'reference':
        FieldClass = types.system.reference

        break
    }

    if (!FieldClass) {
      return value
    }

    const fieldHandler = new FieldClass({...field, path, validator: this})

    if (typeof fieldHandler.cast === 'function') {
      value = fieldHandler.cast({path, value})
    }

    if (typeof fieldHandler.validate === 'function') {
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
    validateMetaFields = true
  }) {
    const fieldErrors = []

    // Looking for fields that are in the object but shouldn't be or don't have
    // the right format.
    const validatedObject = Object.keys(object).reduce((result, fieldName) => {
      if (
        fieldName === '_id' ||
        ignoreFields.includes(fieldName) ||
        (fieldName[0] === '_' && !validateMetaFields)
      ) {
        return result
      }

      const field = schema[fieldName]

      if (!field) {
        fieldErrors.push(
          new FieldValidationError({
            path: path.concat(fieldName),
            type: 'NOT_IN_SCHEMA'
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
              type: 'NOT_IN_SCHEMA'
            })
          )

          return result
        }
      }

      try {
        const validatedValue = Validator.validateField({
          field,
          path: path.concat(fieldName),
          value: object[fieldName]
        })

        return {
          ...result,
          [fieldName]: validatedValue
        }
      } catch (error) {
        fieldErrors.push(error)
      }

      return result
    }, {})

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
                type: 'REQUIRED'
              })
            )
          }
        }
      })
    }

    if (fieldErrors.length > 0) {
      throw new EntryValidationError({fieldErrors})
    }

    return validatedObject
  }

  static validateQuery({query}) {
    if (query.toString() !== '[object Object]') {
      throw new InvalidQueryFilterError()
    }

    const fieldErrors = Object.entries(query).reduce(
      (errors, [fieldName, value]) => {
        if (fieldName[0] === '$') {
          throw new InvalidQueryFilterParameterError({
            path: [fieldName],
            value
          })
        }

        try {
          this.validateQueryField({
            fieldName,
            path: [fieldName],
            value
          })

          return errors
        } catch (error) {
          return errors.concat(error)
        }
      },
      []
    )

    if (fieldErrors.length > 0) {
      throw new InvalidQueryFilterError({fieldErrors})
    }

    return query
  }

  static validateQueryField({fieldName, path, value}) {
    if (value.toString() !== '[object Object]') {
      return value
    }

    if (Object.keys(value).length > 1) {
      throw new InvalidQueryFilterParameterError({
        path,
        value
      })
    }

    const operator = Object.keys(value)[0]

    if (LOGICAL_OPERATORS.includes(operator)) {
      return this.validateQueryField
    }

    if (COMPARISON_OPERATORS.includes(operator)) {
    }
  }
}

module.exports = Validator
