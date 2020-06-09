import {Field, FieldConstructorParameters, FieldOptions} from '../field'

interface FieldMixedConstructorParameters extends FieldConstructorParameters {
  options: object
}

export default class FieldMixed implements Field {
  options: FieldOptions
  subType: 'mixed'
  type: 'primitive'

  constructor({options}: FieldMixedConstructorParameters) {
    this.options = options
  }

  cast({path, value}: {path: Array<string>; value: any}) {
    return value
  }
}
