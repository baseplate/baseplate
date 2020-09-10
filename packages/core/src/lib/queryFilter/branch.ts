import Field from './field'
import isPlainObject from '../utils/isPlainObject'
import {InvalidQueryFilterError} from '../errors'

export default class Branch {
  fields: {[key: string]: Field}

  constructor(fields: {[key: string]: Field}) {
    this.fields = fields
  }

  static parse(
    input: any,
    path: Array<string> = [],
    operatorPrefix: string
  ): Branch {
    if (!isPlainObject(input)) {
      throw new InvalidQueryFilterError()
    }

    if (Object.keys(input).length === 0) {
      return null
    }

    const inputTree: Record<string, any> = {}

    Object.entries(input).forEach(([key, value]) => {
      let pointer = inputTree

      const keyNodes = key.split('.')
      const keyTail = keyNodes.pop()

      keyNodes.forEach((keyNode) => {
        pointer[keyNode] = pointer[keyNode] || {}
        pointer = pointer[keyNode]
      })

      pointer[keyTail] = value
    })

    const fields = Object.entries(inputTree).reduce((result, [key, value]) => {
      return {
        ...result,
        [key]: Field.parse(key, value, path.concat(key), operatorPrefix),
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

  serialize(
    operatorPrefix: string,
    fieldTransform?: Function
  ): Record<string, any> {
    return Object.values(this.fields).reduce(
      (result, field) => ({
        ...result,
        ...field.serialize(operatorPrefix, fieldTransform),
      }),
      {}
    )
  }

  async traverse(callback: Function) {
    await callback(this)

    const values = Object.values(this.fields)

    await Promise.all(values.map((field) => field.traverse(callback)))
  }
}
