import {CastError, FieldValidationError} from '../errors'
import {FieldConstructorParameters, FieldOptions} from '../field'

export interface ConstructorParameters extends FieldConstructorParameters {
  models?: Array<any>
  options: FieldOptions
}

export type ReferenceValue = SingleReferenceValue | Array<SingleReferenceValue>

export interface SingleReferenceValue {
  id: string
  type: string
}

export class FieldHandler {
  options: FieldOptions
  modelNames: Array<string>
  models: Array<any>
  subType: string
  type: 'reference'

  constructor({models, subType, options}: ConstructorParameters) {
    this.models = models
    this.options = options

    this.modelNames = models
      ? models.map((model) => model.base$handle)
      : [subType]
  }

  cast({path, value}: {path: Array<string>; value: ReferenceValue}) {
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

  validate({path, value}: {path: Array<string>; value: ReferenceValue}) {
    const normalizedValue = Array.isArray(value) ? value : [value]
    const isValid = normalizedValue.every(({type}) =>
      this.modelNames.includes(type)
    )

    if (!isValid) {
      throw new FieldValidationError({
        expected: this.modelNames.join('|'),
        path,
        type: 'INVALID_MEMBER',
      })
    }

    return value
  }
}
