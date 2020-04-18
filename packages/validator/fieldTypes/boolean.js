const {CastError} = require('../validation-errors')

class ValidatorTypeBoolean {
  constructor({options}) {
    this.options = options
  }

  cast({path, value}) {
    if (value === undefined || value === null) {
      return false
    }

    if (typeof value === 'boolean') {
      return value
    }

    throw new CastError({path, type: 'boolean', value})
  }
}

module.exports = ValidatorTypeBoolean
