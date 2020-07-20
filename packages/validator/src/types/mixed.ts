import {FieldConstructorParameters, FieldOptions} from '../index'

export {FieldConstructorParameters as ConstructorParameters}

export class FieldHandler {
  options: FieldOptions
  subType: 'mixed'
  type: 'primitive'

  constructor({options}: FieldConstructorParameters) {
    this.options = options
  }

  cast({path, value}: {path: Array<string>; value: any}) {
    return value
  }
}
