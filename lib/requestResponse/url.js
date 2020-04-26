const {InvalidQueryParameterError} = require('../errors')
const isPlainObject = require('../utils/isPlainObject')

const ARRAY_SYNTAX_REGEX = new RegExp(`^(.*)\\[(.*)\\]$`)

class URL {
  constructor({path, pathParameters, queryParameters}) {
    this.path = path
    this.pathParameters = pathParameters || {}
    this.queryParameters = queryParameters
      ? URL.parseQueryParameters(queryParameters)
      : {}
  }

  static buildTreeFromPathArrays(nodes, result) {
    const head = nodes[0]

    if (nodes.length === 1) {
      result[head] = true

      return
    }

    const tail = nodes.slice(1)

    result[head] = typeof result[head] === 'object' ? result[head] : {}

    URL.buildTreeFromPathArrays(tail, result[head])
  }

  static getTreeFromPathArray(arrayPath) {
    if (!arrayPath) {
      return {}
    }

    const tree = {}
    const paths = Array.isArray(arrayPath) ? arrayPath : [arrayPath]

    paths.forEach(path => {
      URL.buildTreeFromPathArrays(path.split('.'), tree)
    })

    return tree
  }

  static parseQueryParameters(queryParameters) {
    return Object.keys(queryParameters).reduce((result, key) => {
      const value = queryParameters[key]
      const arraySyntaxMatch = key.match(ARRAY_SYNTAX_REGEX)

      if (arraySyntaxMatch) {
        const [_, parentKey, childKey] = arraySyntaxMatch

        result[parentKey] = result[parentKey] || {}
        result[parentKey][childKey] = value
      } else {
        result[key] = value
      }

      return result
    }, {})
  }

  static wrapArraySyntax(parameters = {}) {
    return Object.keys(parameters).reduce((result, key) => {
      if (parameters[key].toString() === '[object Object]') {
        Object.entries(parameters[key]).forEach(([subKey, value]) => {
          result[`${key}[${subKey}]`] = value
        })
      } else {
        result[key] = parameters[key]
      }

      return result
    }, {})
  }

  format({overridePath, overrideParameters} = {}) {
    const queryParameters =
      overrideParameters === null
        ? {}
        : {
            ...this.queryParameters,
            ...overrideParameters
          }
    const queryString = Object.entries(queryParameters)
      .map(keyValue => keyValue.join('='))
      .join('&')

    return (overridePath || this.path) + (queryString ? '?' + queryString : '')
  }

  getPathParameter(parameterName) {
    return this.pathParameters[parameterName]
  }

  getQueryParameter(parameterName, {isCSV, isDotPath, isJSON, isNumber} = {}) {
    const transformerFn = input => {
      let output = input

      if (isCSV) {
        output = output.split(',')
      } else if (isJSON) {
        try {
          output = JSON.parse(output)
        } catch (_) {
          throw new InvalidQueryParameterError({parameterName, value: input})
        }
      } else if (isNumber) {
        const number = Number(output)

        if (number.toString() !== output) {
          return
        }

        output = number
      }

      if (isDotPath) {
        output = URL.getTreeFromPathArray(
          Array.isArray(output) ? output : [output]
        )
      }

      return output
    }

    const parameterValue = this.queryParameters[parameterName]

    if (!parameterValue) {
      return
    }

    if (isPlainObject(parameterValue)) {
      return Object.entries(parameterValue).reduce(
        (result, [key, value]) => ({
          ...result,
          [key]: transformerFn(value)
        }),
        {}
      )
    }

    return transformerFn(parameterValue)
  }
}

module.exports = URL
