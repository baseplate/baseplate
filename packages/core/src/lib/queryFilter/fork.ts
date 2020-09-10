import Branch from './branch'

export default class Fork {
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

  serialize(
    operatorPrefix: string,
    fieldTransform?: Function
  ): Record<string, any> {
    const branches = this.branches
      .filter(Boolean)
      .map((branch) => branch.serialize(operatorPrefix, fieldTransform))

    return {
      [operatorPrefix + this.operator]: branches,
    }
  }

  async traverse(callback: Function) {
    await callback(this)
    await Promise.all(this.branches.map((branch) => branch.traverse(callback)))
  }
}
