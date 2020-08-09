import {CastError, FieldValidationError} from '../errors'
import {
  BaseConstructorParameters,
  BaseHandler,
  BaseOptions,
  CastParameters,
  ValidateParameters,
} from '../field'

type ReferenceValue = SingleReferenceValue | Array<SingleReferenceValue>

interface SingleReferenceValue {
  id: string
  type: string
}

export default class FieldReference extends BaseHandler {
  modelNames: Array<string>

  operators = {}

  constructor(props: BaseConstructorParameters) {
    super(props)

    this.modelNames = this.children
      .map(({type}: {type: string}) => type && type.toString().toLowerCase())
      .filter(Boolean)
  }

  cast({path, value}: CastParameters<ReferenceValue>) {
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

  validate({path, value}: ValidateParameters<ReferenceValue>) {
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
