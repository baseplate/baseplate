import {CastError, FieldValidationError} from '../errors'
import {BaseHandler, BaseOptions} from '../field'
import {validateField} from '../validator'

export interface Options extends BaseOptions {
  maxLength?: number
  minLength?: number
}

export default class FieldArray extends BaseHandler {
  children: Array<any>
  options: Options

  static operators = {
    contains: {
      label: 'contains',
    },
  }

  cast({path, value}: {path: Array<string>; value: any}) {
    if (Array.isArray(value)) {
      return value
    }

    const type = `array of ${this.children
      .map(({subType}) => subType)
      .join(' or ')}`

    throw new CastError({path, type, value})
  }

  validate({path, value}: {path: Array<string>; value: any}) {
    const {maxLength, minLength} = this.options

    if (typeof maxLength === 'number' && value.length > maxLength) {
      throw new FieldValidationError({
        detail: `Must have at most ${maxLength} elements`,
        path,
      })
    }

    if (typeof minLength === 'number' && value.length < minLength) {
      throw new FieldValidationError({
        detail: `Must have at least ${minLength} elements`,
        path,
      })
    }

    value.forEach((childValue: any) => {
      const isValid = this.children.every((childType) => {
        try {
          validateField({
            field: childType,
            path,
            value: childValue,
          })

          return true
        } catch (error) {
          return false
        }
      })

      if (!isValid) {
        throw new FieldValidationError({
          expected: this.children.map((child) => child.type).join(' or '),
          path,
          type: 'INVALID_MEMBER',
        })
      }
    })
  }
}
