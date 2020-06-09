import {CastError, FieldValidationError} from '../errors'
import {Field, FieldConstructorParameters, FieldOptions} from '../field'
import {Model} from '../model'

interface FieldReferenceConstructorParameters
  extends FieldConstructorParameters {
  models?: Array<Model>
  options: FieldOptions
}

type ReferenceValue = SingleReferenceValue | Array<SingleReferenceValue>

interface SingleReferenceValue {
  id: string
  type: string
}

export default class FieldReference implements Field {
  options: FieldOptions
  modelNames: Array<string>
  models: Array<Model>
  subType: string
  type: 'reference'

  constructor({models, options}: FieldReferenceConstructorParameters) {
    this.models = models
    this.options = options

    this.modelNames = models.map((model) => model.handle)
    this.subType = this.modelNames[0]
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
