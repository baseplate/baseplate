const {CastError, FieldValidationError} = require('../errors')

class ValidatorTypeArray {
  constructor({children, options, validator}) {
    this.children = children
    this.options = options
    this.validator = validator
  }

  cast({path, value}) {
    if (Array.isArray(value)) {
      return value
    }

    const type = `array of ${this.children
      .map(({subType}) => subType)
      .join(' or ')}`

    throw new CastError({path, type, value})
  }

  validate({path, value}) {
    const {maxLength, minLength} = this.options

    if (typeof maxLength === 'number' && value.length > maxLength) {
      throw new FieldValidationError({
        detail: `Must have at most ${maxLength} elements`,
        path
      })
    }

    if (typeof minLength === 'number' && value.length < minLength) {
      throw new FieldValidationError({
        detail: `Must have at least ${minLength} elements`,
        path
      })
    }

    value.forEach(childValue => {
      const isValid = this.children.some(childType => {
        try {
          this.validator.validateField({
            field: childType,
            path,
            value: childValue
          })

          return true
        } catch (error) {
          return false
        }
      })

      if (!isValid) {
        throw new CastError({
          path,
          type: this.children.map(({subType}) => subType).join(' or '),
          value
        })
      }
    })
  }
}

module.exports = ValidatorTypeArray
