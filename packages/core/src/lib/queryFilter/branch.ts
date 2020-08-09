import Field from './field'
import isPlainObject from '../utils/isPlainObject'
import {InvalidQueryFilterError} from '../errors'

export default class Branch {
  fields: {[key: string]: Field}

  constructor(fields: {[key: string]: Field}) {
    this.fields = fields
  }

  static parse(input: any, path: Array<string> = [], prefix: string): Branch {
    if (!isPlainObject(input)) {
      throw new InvalidQueryFilterError()
    }

    if (Object.keys(input).length === 0) {
      return null
    }

    const fields = Object.entries(input).reduce((result, [key, value]) => {
      return {
        ...result,
        [key]: Field.parse(key, value, path.concat(key), prefix),
      }
    }, {})

    return new this(fields)
  }

  clone(): Branch {
    const fields = Object.entries(this.fields).reduce(
      (result, [name, field]) => ({
        ...result,
        [name]: field.clone(),
      }),
      {}
    )

    return new Branch(fields)
  }

  serialize(prefix: string, fieldTransform?: Function): Record<string, any> {
    return Object.entries(this.fields).reduce((result, [name, field]) => {
      return {
        ...result,
        [name]: field.serialize(prefix, fieldTransform),
      }
    }, {})
  }
}
