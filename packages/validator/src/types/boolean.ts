import {CastError} from '../errors'
import {FieldOptions} from '../index'

export class FieldHandler {
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
