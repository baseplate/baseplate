import {CastError} from '../errors'
import {Field, FieldOptions} from '../field'

export default class FieldBoolean implements Field {
  options: FieldOptions
  subType: 'boolean'
  type: 'primitive'

  cast({path, value}: {path: Array<string>; value: any}) {
    if (value === undefined || value === null) {
      return false
    }

    if (typeof value === 'boolean') {
      return value
    }

    throw new CastError({path, type: 'boolean', value})
  }
}
