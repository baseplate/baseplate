import {CastError, FieldValidationError} from '../errors'
import {FieldConstructorParameters, FieldOptions} from '../field'
import {Validator} from '../validator'

export interface ConstructorParameters extends FieldConstructorParameters {
  children?: Array<any>
  options: Options
  validator?: typeof Validator
}

export interface Options extends FieldOptions {
  children?: Array<any>
  maxLength?: number
  minLength?: number
}

export class FieldHandler {
  children: Array<any>
  options: Options
  type: 'array'
  validator: typeof Validator

  constructor({children, options, validator}: ConstructorParameters) {
    this.children = children
    this.options = options
    this.validator = validator
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
      const isValid = this.children.some((childType) => {
        try {
          this.validator.validateField({
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
        throw new CastError({
          path,
          type: this.children.map(({subType}) => subType).join(' or '),
          value,
        })
      }
    })
  }
}
