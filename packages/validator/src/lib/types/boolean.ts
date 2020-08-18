import {CastError} from '../errors'
import {BaseHandler} from '../field'

export default class FieldBoolean extends BaseHandler {
  operators = {}

  cast({path, value}: {path: string[]; value: any}) {
    if (value === undefined || value === null) {
      return false
    }

    if (typeof value === 'boolean') {
      return value
    }

    throw new CastError({path, type: 'boolean', value})
  }
}
