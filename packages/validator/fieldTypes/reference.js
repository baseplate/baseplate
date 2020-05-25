const {CastError, FieldValidationError} = require('../errors')

class ValidatorTypeReference {
  constructor({models, modelStore, options, subType}) {
    this.modelNames = Array.isArray(subType) ? subType : [subType]
    this.modelStore = modelStore
    this.options = options
    this.models = models
  }

  cast({path, value}) {
    if (!value) return value

    const normalizedValue = Array.isArray(value) ? value : [value]
    const isValid = normalizedValue.every(({id, type}) => {
      return id && typeof id === 'string' && type && typeof type === 'string'
    })

    if (!isValid) {
      throw new CastError({path, type: this.modelNames.join(', '), value})
    }

    return value
  }

  validate({path, value}) {
    const normalizedValue = Array.isArray(value) ? value : [value]
    const isValid = normalizedValue.every(({type}) =>
      this.modelNames.includes(type)
    )

    if (!isValid) {
      throw new FieldValidationError({
        expected: this.modelNames.join('|'),
        path,
        type: 'INVALID_MEMBER'
      })
    }

    return value
  }
}

module.exports = ValidatorTypeReference
