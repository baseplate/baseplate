const {CastError, FieldValidationError} = require('../errors')

class ValidatorTypeString {
  constructor({options} = {}) {
    this.options = options || {}
  }

  cast({path, value}) {
    const {lowerCase, trim, upperCase} = this.options

    if (typeof value === 'string') {
      let castedValue = value

      if (trim) {
        castedValue = castedValue.trim()
      }

      if (upperCase) {
        castedValue = castedValue.toUpperCase()
      } else if (lowerCase) {
        castedValue = castedValue.toLowerCase()
      }

      return castedValue
    }

    throw new CastError({path, type: 'string', value})
  }

  validate({path, value}) {
    const {enum: enumValues, match, maxLength, minLength} = this.options

    if (Array.isArray(enumValues)) {
      const isValid = enumValues.some(acceptedValue => {
        return value === acceptedValue
      })

      if (!isValid) {
        const acceptedValues = enumValues.join(' or ')

        throw new FieldValidationError({
          detail: `Is not one of the accepted values (expected ${acceptedValues})`,
          path
        })
      }
    }

    if (typeof maxLength === 'number' && value.length > maxLength) {
      throw new FieldValidationError({
        detail: `Must have a maximum length of ${maxLength}`,
        path
      })
    }

    if (typeof minLength === 'number' && value.length < minLength) {
      throw new FieldValidationError({
        detail: `Must have a minimum length of ${minLength}`,
        path
      })
    }

    if (match instanceof RegExp && !value.match(match)) {
      throw new FieldValidationError({
        detail: `Must match validation expression`,
        path
      })
    }
  }
}

module.exports = ValidatorTypeString
