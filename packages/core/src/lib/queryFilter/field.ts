import isPlainObject from '../utils/isPlainObject'
import {InvalidQueryFilterParameterError} from '../errors'

const COMPARISON_OPERATORS = [
  'eq',
  'gt',
  'gte',
  'in',
  'lt',
  'lte',
  'ne',
  'nin',
  'not',
]

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

    if (Object.keys(input).length > 1) {
      throw new InvalidQueryFilterParameterError({
        path,
      })
    }

    const key = Object.keys(input)[0]
    const operator =
      key.substring(0, prefix.length) === prefix &&
      key.substring(prefix.length).toLowerCase()

    if (!COMPARISON_OPERATORS.includes(operator)) {
      throw new InvalidQueryFilterParameterError({
        path,
      })
    }

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

    if (isNegated) {
      return {[`${prefix}not`]: valueWithOperator}
    }

    return valueWithOperator
  }
}
