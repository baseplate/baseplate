const {CastError, FieldValidationError} = require('../validationErrors')

class ValidatorTypeReference {
  constructor({modelStore, options, schemas, subType}) {
    this.modelNames = Array.isArray(subType) ? subType : [subType]
    this.modelStore = modelStore
    this.options = options
    this.schemas = schemas
  }

  cast({path, value}) {
    if (!value) return value

    const normalizedValue = Array.isArray(value) ? value : [value]
    const isValid = normalizedValue.every(({_id, _type}) => {
      return (
        _id && typeof _id === 'string' && _type && typeof _type === 'string'
      )
    })

    if (!isValid) {
      throw new CastError({path, type: this.modelNames.join(', '), value})
    }

    return value
  }

  validate({path, value}) {
    const normalizedValue = Array.isArray(value) ? value : [value]
    const isValid = normalizedValue.every(({_type}) =>
      this.modelNames.includes(_type)
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
