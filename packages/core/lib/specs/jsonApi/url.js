const {InvalidQueryParameterError} = require('../../errors')
const isPlainObject = require('../../utils/isPlainObject')

class JsonApiURL {
  constructor(url) {
    this.path = url.pathname
    this.queryParameters = JsonApiURL.parseQueryParameters(url.searchParams)
  }

  static buildTreeFromPathArrays(nodes, result) {
    const head = nodes[0]

    if (nodes.length === 1) {
      result[head] = true

      return
    }

    const tail = nodes.slice(1)

    result[head] = typeof result[head] === 'object' ? result[head] : {}

    JsonApiURL.buildTreeFromPathArrays(tail, result[head])
  }

  static getTreeFromPathArray(arrayPath) {
    if (!arrayPath) {
      return {}
    }

    const tree = {}
    const paths = Array.isArray(arrayPath) ? arrayPath : [arrayPath]

    paths.forEach(path => {
      JsonApiURL.buildTreeFromPathArrays(path.split('.'), tree)
    })

    return tree
  }

  static parseQueryParameters(queryParameters) {
    const parsedQueryParameters = {}

    for (const [key, value] of queryParameters) {
      const arraySyntaxMatch = key.match(/^(.*)\\[(.*)\\]$/)

      if (arraySyntaxMatch) {
        const [_, parentKey, childKey] = arraySyntaxMatch

        parsedQueryParameters[parentKey] =
          parsedQueryParameters[parentKey] || {}
        parsedQueryParameters[parentKey][childKey] = value
      } else {
        parsedQueryParameters[key] = value
      }
    }

    return parsedQueryParameters
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

  getQueryParameter(name) {
    let options

    switch (name) {
      case 'fields':
        options = {isCSV: true}

        break

      case 'filter':
        options = {isJSON: true}

        break

      case 'include':
        options = {
          isCSV: true,
          isDotPath: true
        }

        break

      case 'page':
        options = {
          isCSV: true,
          isDotPath: true
        }

        break

      case 'sort':
        options = {
          isCSV: true
        }

        break
    }

    return this.getRawParameter(name, options)
  }

  getRawParameter(name, {isCSV, isDotPath, isJSON, isNumber} = {}) {
    const transformerFn = input => {
      let output = input

      if (isCSV) {
        output = output.split(',')
      } else if (isJSON) {
        try {
          output = JSON.parse(output)
        } catch (_) {
          throw new InvalidQueryParameterError({name, value: input})
        }
      } else if (isNumber) {
        const number = Number(output)

        if (number.toString() !== output) {
          return
        }

        output = number
      }

      if (isDotPath) {
        output = JsonApiURL.getTreeFromPathArray(
          Array.isArray(output) ? output : [output]
        )
      }

      return output
    }

    const parameterValue = this.queryParameters[name]

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

module.exports = JsonApiURL
