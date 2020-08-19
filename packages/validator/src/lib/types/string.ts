import {BaseHandler, BaseOptions} from '../field'
import {FieldValidationError} from '../errors'

export interface Options extends BaseOptions {
  lowerCase?: boolean
  enum?: Array<string>
  match?: RegExp
  maxLength?: number
  minLength?: number
  search?: {
    weight: number
  }
  trim?: boolean
  upperCase?: boolean
}

export default class FieldString extends BaseHandler {
  options: Options

  static operators = {
    eq: {
      label: 'is',
    },
    ne: {
      label: 'is not',
    },
  }

  static options = {
    lowerCase: Boolean,
    enum: [String],
    match: {
      type: 'Mixed',
      validate: (input: any) => input instanceof RegExp,
      errorMessage: 'Must be a regular expression',
    },
    maxLength: Number,
    minLength: Number,
    search: {
      weight: {
        min: 1,
        max: 10,
        type: Number,
      },
    },
    trim: Boolean,
    upperCase: Boolean,
  }

  cast({path, value}: {path: string[]; value: any}) {
    if (typeof value !== 'string') {
      throw new FieldValidationError({path, type: 'string'})
    }

    const {
      enum: enumValues,
      lowerCase,
      match,
      maxLength,
      minLength,
      trim,
      upperCase,
    } = this.options

    if (trim) {
      value = value.trim()
    }

    if (upperCase) {
      value = value.toUpperCase()
    } else if (lowerCase) {
      value = value.toLowerCase()
    }

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

    if (typeof maxLength === 'number' && value.length > maxLength) {
      throw new FieldValidationError({
        detail: `Must have a maximum length of ${maxLength}`,
        path,
      })
    }

    if (typeof minLength === 'number' && value.length < minLength) {
      throw new FieldValidationError({
        detail: `Must have a minimum length of ${minLength}`,
        path,
      })
    }

    if (match instanceof RegExp && !value.match(match)) {
      throw new FieldValidationError({
        detail: `Must match validation expression`,
        path,
      })
    }

    return value
  }
}
