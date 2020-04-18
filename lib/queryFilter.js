const isPlainObject = require('./utils/isPlainObject')
const {
  InvalidQueryFilterError,
  InvalidQueryFilterParameterError
} = require('./errors')

const BRANCH_OPERATORS = ['and', 'nor', 'or']
const COMPARISON_OPERATORS = [
  'eq',
  'gt',
  'gte',
  'in',
  'lt',
  'lte',
  'ne',
  'nin',
  'not'
]

class QueryFilter {
  constructor(root) {
    this.root = root
  }

  static parse(node, prefix) {
    const root = node ? this.parseNode(node, {path: [], prefix}) : null

    return new this(root)
  }

  static parseBranch(node, {path = [], prefix}) {
    if (!isPlainObject(node)) {
      throw new InvalidQueryFilterError({
        value: node
      })
    }

    if (Object.keys(node).length === 0) {
      return null
    }

    const fields = Object.entries(node).reduce((result, [key, value]) => {
      return {
        ...result,
        [key]: this.parseField(value, {
          path: path.concat(key),
          prefix
        })
      }
    }, {})

    return {
      type: 'branch',
      fields
    }
  }

  static parseField(field, {path, prefix}) {
    if (!isPlainObject(field)) {
      return {
        isNegated: false,
        operator: 'eq',
        value: field
      }
    }

    if (Object.keys(field).length > 1) {
      throw new InvalidQueryFilterParameterError({
        path,
        value: field
      })
    }

    const key = Object.keys(field)[0]
    const operator =
      key.substring(0, prefix.length) === prefix &&
      key.substring(prefix.length).toLowerCase()

    if (!COMPARISON_OPERATORS.includes(operator)) {
      throw new InvalidQueryFilterParameterError({
        path,
        value: field
      })
    }

    const isNegated = operator === 'not'

    if (isNegated) {
      const innerField = this.parseField(field[key], {
        path: path.concat(key),
        prefix
      })

      return {
        isNegated,
        operator: innerField.operator,
        value: innerField.value
      }
    }

    return {
      isNegated,
      operator,
      value: field[key]
    }
  }

  static parseNode(node, {path, prefix}) {
    let isBranchOperator = false
    let normalizedBranchOperator

    const operatorMatch = Object.keys(node).find(key => {
      const isOperator = prefix && key.substring(0, prefix.length) === prefix

      if (!isOperator) return false

      normalizedBranchOperator = key.substring(prefix.length).toLowerCase()

      if (BRANCH_OPERATORS.includes(normalizedBranchOperator)) {
        isBranchOperator = true

        return true
      }

      throw new InvalidQueryFilterParameterError({
        path: path.concat(key),
        node
      })
    })

    if (isBranchOperator) {
      if (Object.keys(node).length > 1 || !Array.isArray(node[operatorMatch])) {
        throw new InvalidQueryFilterParameterError({
          path,
          value: node
        })
      }

      return {
        type: 'fork',
        branches: node[operatorMatch].map(childNode =>
          this.parseNode(childNode, {path: path.concat(operatorMatch), prefix})
        ),
        operator: normalizedBranchOperator
      }
    }

    return this.parseBranch(node, {path, prefix})
  }

  and(subject) {
    const isThisAnd =
      this.root && this.root.type === 'fork' && this.root.operator === 'and'
    const isSubjectAnd =
      subject.root &&
      subject.root.type === 'fork' &&
      subject.root.operator === 'and'

    if (isThisAnd && isSubjectAnd) {
      this.root.branches = this.root.branches.concat(subject.root.branches)
    } else {
      this.root = {
        type: 'fork',
        branches: [this.root, subject.root],
        operator: 'and'
      }
    }

    return this
  }

  serialize(node, prefix) {
    if (!node) {
      return {}
    }

    if (node.type === 'fork') {
      const branches = node.branches
        .filter(Boolean)
        .map(branch => this.serialize(branch, prefix))

      return {
        [prefix + node.operator]: branches
      }
    }

    if (node.type === 'branch') {
      return Object.keys(node.fields).reduce((result, key) => {
        const {isNegated, operator, value} = node.fields[key]
        const valueWithOperator = {[prefix + operator]: value}

        return {
          ...result,
          [key]: isNegated
            ? {[`${prefix}not`]: valueWithOperator}
            : valueWithOperator
        }
      }, {})
    }
  }

  toObject(prefix) {
    return this.serialize(this.root, prefix)
  }
}

module.exports = QueryFilter
