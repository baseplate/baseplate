import Branch from './branch'
import Fork from './fork'
import {InvalidQueryFilterParameterError} from '../errors'

const BRANCH_OPERATORS = ['and', 'nor', 'or']

export default class QueryFilter {
  root: Branch | Fork

  constructor(node?: any, prefix: string = '$') {
    this.root = node ? QueryFilter.parse(node, prefix) : null
  }

  static fromInternals(root: Branch | Fork) {
    const instance = new this()

    instance.root = root

    return instance
  }

  static parse(node: any, prefix: string = '$') {
    const root = node ? this.parseNode(node, prefix, []) : null

    return root
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

    return QueryFilter.fromInternals(root)
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

  serialize(prefix: string, fieldTransform?: Function) {
    if (!this.root) {
      return {}
    }

    return this.root.serialize(prefix, fieldTransform)
  }

  toJSON() {
    return this.toObject()
  }

  toObject({
    fieldTransform,
    prefix = '$',
  }: {fieldTransform?: Function; prefix?: string} = {}) {
    return this.serialize(prefix, fieldTransform)
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
