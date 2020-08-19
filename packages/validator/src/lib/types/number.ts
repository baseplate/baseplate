import {BaseHandler, BaseOptions} from '../field'
import {FieldValidationError} from '../errors'

export interface Options extends BaseOptions {
  enum?: Array<number>
  max?: number
  min?: number
}

export default class FieldNumber extends BaseHandler {
  static operators = {
    eq: {
      label: 'is',
    },
    gt: {
      label: 'is greater than',
    },
    gte: {
      label: 'is greater than or equal to',
    },
    lt: {
      label: 'is less than',
    },
    lte: {
      label: 'is less than or equal to',
    },
    ne: {
      label: 'is not',
    },
  }

  cast({path, value}: {path: string[]; value: any}) {
    if (typeof value === 'string') {
      const parsedNumber = Number.parseFloat(value)

      if (parsedNumber.toString() === value) {
        value = parsedNumber
      }
    }

    if (typeof value !== 'number') {
      throw new FieldValidationError({path, type: 'number'})
    }

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

    return value
  }
}
