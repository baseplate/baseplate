import {URL, URLSearchParams} from 'url'

import {InvalidQueryParameterError} from '../../errors'
import isPlainObject from '../../utils/isPlainObject'

interface FormatParameters {
  overrideParameters?: Record<string, any>
  overridePath?: string
}

interface QueryParameterTransformationOptions {
  isCSV?: boolean
  isDotPath?: boolean
  isJSON?: boolean
  isNumber?: boolean
}

type QueryParameterTreeBranch = {
  [propName: string]: boolean | QueryParameterTreeBranch
}

export default class JsonApiURL {
  path: string
  queryParameters: Record<string, any>

  constructor(url: URL) {
    this.path = url.pathname
    this.queryParameters = JsonApiURL.parseQueryParameters(url.searchParams)
  }

  static buildTreeFromPathArrays(
    nodes: Array<string>,
    result: QueryParameterTreeBranch
  ) {
    const head = nodes[0]

    if (nodes.length === 1) {
      result[head] = true

      return
    }

    const tail = nodes.slice(1)

    result[head] = typeof result[head] === 'object' ? result[head] : {}

    JsonApiURL.buildTreeFromPathArrays(
      tail,
      <QueryParameterTreeBranch>result[head]
    )
  }

  static getTreeFromPathArray(arrayPath: Array<string>) {
    if (!arrayPath) {
      return {}
    }

    const tree = {}
    const paths = Array.isArray(arrayPath) ? arrayPath : [arrayPath]

    paths.forEach((path) => {
      JsonApiURL.buildTreeFromPathArrays(path.split('.'), tree)
    })

    return tree
  }

  static parseQueryParameters(queryParameters: URLSearchParams) {
    const parsedQueryParameters: Record<string, any> = {}

    for (const [key, value] of queryParameters) {
      const arraySyntaxMatch = key.match(/^(.*)\[(.*)\]$/)

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

  static wrapArraySyntax(parameters: Record<string, any> = {}) {
    return Object.keys(parameters).reduce(
      (result: Record<string, any>, key: string) => {
        if (parameters[key].toString() === '[object Object]') {
          Object.entries(parameters[key]).forEach(([subKey, value]) => {
            result[`${key}[${subKey}]`] = value
          })
        } else {
          result[key] = parameters[key]
        }

        return result
      },
      {}
    )
  }

  format({overrideParameters, overridePath = null}: FormatParameters = {}) {
    const queryParameters =
      overrideParameters === null
        ? {}
        : {
            ...this.queryParameters,
            ...overrideParameters,
          }
    const formattedParameters = JsonApiURL.wrapArraySyntax(queryParameters)
    const queryString = Object.entries(formattedParameters)
      .map((keyValue) => keyValue.join('='))
      .join('&')

    return (overridePath || this.path) + (queryString ? '?' + queryString : '')
  }

  getQueryParameter(name: string) {
    let options: QueryParameterTransformationOptions

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
          isDotPath: true,
        }

        break

      case 'page':
        options = {
          isNumber: true,
        }

        break

      case 'sort':
        options = {
          isCSV: true,
        }

        break
    }

    return this.getRawParameter(name, options)
  }

  getRawParameter(
    name: string,
    {
      isCSV,
      isDotPath,
      isJSON,
      isNumber,
    }: QueryParameterTransformationOptions = {}
  ) {
    const transformerFn = (input: any) => {
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
          [key]: transformerFn(value),
        }),
        {}
      )
    }

    return transformerFn(parameterValue)
  }
}
