import {FieldValidationError} from '../errors'
import {BaseConstructorParameters, BaseHandler} from '../field'

export default class FieldReference extends BaseHandler {
  modelNames: Array<string>

  constructor(props: BaseConstructorParameters) {
    super(props)

    this.modelNames = this.children
      .map(({type}: {type: string}) => type && type.toString().toLowerCase())
      .filter(Boolean)
  }

  cast({path, value}: {path: string[]; value: any}) {
    if (!value) return value

    const normalizedValue = Array.isArray(value) ? value : [value]
    const isValid = normalizedValue.every(
      ({id, type}) =>
        id &&
        typeof id === 'string' &&
        type &&
        typeof type === 'string' &&
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
