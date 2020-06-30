import isPlainObject from './utils/isPlainObject'
import {
  InvalidQueryFilterError,
  InvalidQueryFilterParameterError,
} from './errors'

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
  'not',
]

type SerializedNode = {[key: string]: any}

export class Branch {
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
        [key]: Field.parse(value, path.concat(key), prefix),
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

  serialize(prefix: string): SerializedNode {
    return Object.entries(this.fields).reduce((result, [name, field]) => {
      return {
        ...result,
        [name]: field.serialize(prefix),
      }
    }, {})
  }
}

export class Field {
  isNegated: boolean
  operator: string
  value: any

  constructor(value: any, operator: string, isNegated: boolean = false) {
    this.isNegated = isNegated
    this.operator = operator
    this.value = value
  }

  static parse(input: any, path: Array<string>, prefix: string): Field {
    if (!isPlainObject(input)) {
      return new this(input, 'eq')
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
      const innerField = this.parse(input[key], path.concat(key), prefix)

      return new this(innerField.value, innerField.operator, isNegated)
    }

    return new this(input[key], operator, isNegated)
  }

  clone(): Field {
    return new Field(this.value, this.operator, this.isNegated)
  }

  serialize(prefix: string): SerializedNode {
    const {isNegated, operator, value} = this
    const valueWithOperator = {[prefix + operator]: value}

    if (isNegated) {
      return {[`${prefix}not`]: valueWithOperator}
    }

    return valueWithOperator
  }
}

export class Fork {
  branches: Array<Branch | Fork>
  operator: string

  constructor(branches: Array<Branch | Fork>, operator: string) {
    this.branches = branches
    this.operator = operator
  }

  clone(): Fork {
    const branches = this.branches.map((item) => item.clone())

    return new Fork(branches, this.operator)
  }

  serialize(prefix: string): SerializedNode {
    const branches = this.branches
      .filter(Boolean)
      .map((branch) => branch.serialize(prefix))

    return {
      [prefix + this.operator]: branches,
    }
  }
}

export default class QueryFilter {
  root: Branch | Fork

  constructor(root: Branch | Fork) {
    this.root = root
  }

  static parse(node: any, prefix: string = '$'): QueryFilter {
    const root = node ? this.parseNode(node, prefix, []) : null

    return new this(root)
  }

  static parseNode(
    node: any,
    prefix: string,
    path: Array<string>
  ): Branch | Fork {
    if (!node) {
      return null
    }

    let isBranchOperator = false
    let normalizedBranchOperator: string

    const operatorMatch = Object.keys(node).find((key) => {
      const isOperator = prefix && key.substring(0, prefix.length) === prefix

      if (!isOperator) return false

      normalizedBranchOperator = key.substring(prefix.length).toLowerCase()

      if (BRANCH_OPERATORS.includes(normalizedBranchOperator)) {
        isBranchOperator = true

        return true
      }

      throw new InvalidQueryFilterParameterError({
        path: path.concat(key),
      })
    })

    if (isBranchOperator) {
      if (Object.keys(node).length > 1 || !Array.isArray(node[operatorMatch])) {
        throw new InvalidQueryFilterParameterError({
          path,
        })
      }

      return new Fork(
        node[operatorMatch].map((childNode: any) =>
          this.parseNode(childNode, prefix, path.concat(operatorMatch))
        ),
        normalizedBranchOperator
      )
    }

    return Branch.parse(node, path, prefix)
  }

  cleanDeadBranches() {
    if (!this.root || !(this.root instanceof Fork)) {
      return
    }

    const branches = this.root.branches.filter(Boolean)

    if (branches.length === 1) {
      this.root = branches[0]
    }
  }

  clone() {
    const root = this.root ? this.root.clone() : this.root

    return new QueryFilter(root)
  }

  intersectWith(subject: QueryFilter) {
    if (!subject) return this

    const isThisAnd = this.root instanceof Fork && this.root.operator === 'and'
    const isSubjectAnd =
      subject.root instanceof Fork && subject.root.operator === 'and'

    if (isThisAnd && isSubjectAnd) {
      const thisRoot = this.root as Fork
      const subjectRoot = subject.root as Fork

      thisRoot.branches = thisRoot.branches.concat(subjectRoot.branches)
    } else {
      this.root = new Fork([this.root as Fork, subject.root as Fork], 'and')
    }

    this.cleanDeadBranches()

    return this
  }

  serialize(prefix: string) {
    if (!this.root) {
      return {}
    }

    return this.root.serialize(prefix)
  }

  toJSON() {
    return this.toObject('$')
  }

  toObject(prefix: string) {
    return this.serialize(prefix)
  }

  traverse(callback: Function, root = this.root) {
    if (!root) {
      return
    }

    if (root instanceof Branch) {
      Object.entries(root.fields).forEach(([name, field]) => {
        callback(name, field)
      })
    } else if (root instanceof Fork) {
      root.branches.forEach((branch) => {
        this.traverse(callback, branch)
      })
    }
  }

  uniteWith(subject: QueryFilter) {
    const isThisOr = this.root instanceof Fork && this.root.operator === 'or'
    const isSubjectOr =
      subject.root instanceof Fork && subject.root.operator === 'or'

    if (isThisOr && isSubjectOr) {
      const thisRoot = this.root as Fork
      const subjectRoot = subject.root as Fork

      thisRoot.branches = thisRoot.branches.concat(subjectRoot.branches)
    } else {
      this.root = new Fork([this.root as Fork, subject.root as Fork], 'or')
    }

    this.cleanDeadBranches()

    return this
  }
}
