import Branch from './branch'
import Fork from './fork'
import {InvalidQueryFilterParameterError} from '../errors'

const BRANCH_OPERATORS = ['and', 'nor', 'or']

export default class QueryFilter {
  root: Branch | Fork

  constructor(node?: any, operatorPrefix: string = '$') {
    this.root = node ? QueryFilter.parse(node, operatorPrefix) : null
  }

  static fromInternals(root: Branch | Fork) {
    const instance = new this()

    instance.root = root

    return instance
  }

  static parse(node: any, operatorPrefix: string = '$') {
    return node ? this.parseNode(node, operatorPrefix, []) : null
  }

  static parseNode(
    node: any,
    operatorPrefix: string,
    path: Array<string>
  ): Branch | Fork {
    if (!node) {
      return null
    }

    let isBranchOperator = false
    let normalizedBranchOperator: string

    const operatorMatch = Object.keys(node).find((key) => {
      const isOperator =
        operatorPrefix &&
        key.substring(0, operatorPrefix.length) === operatorPrefix

      if (!isOperator) return false

      normalizedBranchOperator = key
        .substring(operatorPrefix.length)
        .toLowerCase()

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
          this.parseNode(childNode, operatorPrefix, path.concat(operatorMatch))
        ),
        normalizedBranchOperator
      )
    }

    return Branch.parse(node, path, operatorPrefix)
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

  getId() {
    return (
      this.root instanceof Branch &&
      this.root.fields._id &&
      this.root.fields._id.value
    )
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
      if (this.root instanceof Branch && subject.root instanceof Branch) {
        const thisFields = Object.keys(this.root.fields)
        const subjectFields = Object.keys(subject.root.fields)
        const hasCommonFields = thisFields.some((fieldName) =>
          subjectFields.includes(fieldName)
        )

        // When intercepting two branches, we can simply merge their fields
        // together, as long as there are no common fields between the two.
        if (!hasCommonFields) {
          this.root.fields = {
            ...this.root.fields,
            ...subject.root.fields,
          }

          return this
        }
      }

      this.root = new Fork([this.root as Fork, subject.root as Fork], 'and')
    }

    this.cleanDeadBranches()

    return this
  }

  removeId() {
    if (this.root instanceof Branch) {
      delete this.root.fields._id
    }
  }

  serialize(operatorPrefix: string, fieldTransform?: Function) {
    if (!this.root) {
      return {}
    }

    return this.root.serialize(operatorPrefix, fieldTransform)
  }

  toJSON() {
    return this.toObject()
  }

  toObject({
    fieldTransform,
    operatorPrefix = '$',
  }: {fieldTransform?: Function; operatorPrefix?: string} = {}) {
    return this.serialize(operatorPrefix, fieldTransform)
  }

  async traverse(callback: Function) {
    if (this.root) {
      await this.root.traverse(callback)
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
