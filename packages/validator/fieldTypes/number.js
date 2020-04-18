const {CastError, FieldValidationError} = require('../validation-errors')

class ValidatorTypeNumber {
  constructor({options} = {}) {
    this.options = options || {}
  }

  cast({path, value}) {
    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string') {
      const parsedNumber = Number.parseFloat(value)

      if (parsedNumber.toString() === value) {
        return parsedNumber
      }
    }

    throw new CastError({path, type: 'number', value})
  }

  validate({path, value}) {
    const {enum: enumValues, max, min} = this.options

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

    if (typeof max === 'number' && value > max) {
      throw new FieldValidationError({
        detail: `Must be at most ${max}`,
        path
      })
    }

    if (typeof min === 'number' && value < min) {
      throw new FieldValidationError({
        detail: `Must be at least ${min}`,
        path
      })
    }
  }
}

module.exports = ValidatorTypeNumber
