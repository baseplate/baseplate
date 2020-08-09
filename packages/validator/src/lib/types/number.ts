import {BaseConstructorParameters, BaseHandler, BaseOptions} from '../field'
import {CastError, FieldValidationError} from '../errors'

export interface Options extends BaseOptions {
  enum?: Array<number>
  max?: number
  min?: number
}

export default class FieldNumber extends BaseHandler {
  cast({path, value}: {path: Array<string>; value: any}) {
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

  validate({path, value}: {path: Array<string>; value: any}) {
    const {enum: enumValues, max, min} = this.options

    if (Array.isArray(enumValues)) {
      const isValid = enumValues.some((acceptedValue) => {
        return value === acceptedValue
      })

      if (!isValid) {
        const acceptedValues = enumValues.join(' or ')

        throw new FieldValidationError({
          detail: `Is not one of the accepted values (expected ${acceptedValues})`,
          path,
        })
      }
    }

    if (typeof max === 'number' && value > max) {
      throw new FieldValidationError({
        detail: `Must be at most ${max}`,
        path,
      })
    }

    if (typeof min === 'number' && value < min) {
      throw new FieldValidationError({
        detail: `Must be at least ${min}`,
        path,
      })
    }
  }
}
