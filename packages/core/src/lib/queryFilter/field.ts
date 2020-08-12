import isPlainObject from '../utils/isPlainObject'
import {InvalidQueryFilterParameterError} from '../errors'

export default class Field {
  isNegated: boolean
  name: string
  operator: string
  value: any

  constructor(
    name: string,
    value: any,
    operator: string,
    isNegated: boolean = false
  ) {
    this.name = name
    this.isNegated = isNegated
    this.operator = operator
    this.value = value
  }

  static parse(
    name: string,
    input: any,
    path: Array<string>,
    prefix: string
  ): Field {
    if (!isPlainObject(input)) {
      return new this(name, input, 'eq')
    }

    const stats: Record<'fields' | 'operators', number> = Object.keys(
      input
    ).reduce(
      (stats, key) => {
        if (key.startsWith(prefix)) {
          stats.operators++
        } else {
          stats.fields++
        }

        return stats
      },
      {
        fields: 0,
        operators: 0,
      }
    )

    if ((stats.fields > 0 && stats.operators > 0) || stats.operators > 1) {
      throw new InvalidQueryFilterParameterError({
        path,
      })
    }

    if (stats.operators === 0) {
      return new this(name, input, 'eq')
    }

    const key = Object.keys(input)[0]
    const operator =
      key.substring(0, prefix.length) === prefix &&
      key.substring(prefix.length).toLowerCase()
    const isNegated = operator === 'not'

    if (isNegated) {
      const innerField = this.parse(name, input[key], path.concat(key), prefix)

      return new this(name, innerField.value, innerField.operator, isNegated)
    }

    return new this(name, input[key], operator, isNegated)
  }

  clone(): Field {
    return new Field(this.name, this.value, this.operator, this.isNegated)
  }

  serialize(prefix: string, fieldTransform?: Function): Record<string, any> {
    const {isNegated, name, operator, value} = this
    const transformedValue = fieldTransform
      ? fieldTransform({name, operator, value})
      : value
    const valueWithOperator = {[prefix + operator]: transformedValue}
    const valueWithOperatorAndNegation = isNegated
      ? {[`${prefix}not`]: valueWithOperator}
      : valueWithOperator

    return {
      [name]: valueWithOperatorAndNegation,
    }
  }
}
