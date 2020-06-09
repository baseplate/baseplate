const {GraphQLList} = require('graphql')
const {types} = require('@baseplate/validator')

class GraphQLTypeArray extends types.system.array {
  constructor({memberType, ...options}) {
    super(options)

    this.memberType = memberType
  }

  getGraphQLInputType({fieldName}) {
    const memberType = this.memberType.getGraphQLInputType({fieldName})

    return {
      type: new GraphQLList(memberType.type),
    }
  }

  getGraphQLOutputType({fieldName}) {
    const memberType = this.memberType.getGraphQLOutputType({fieldName})

    return {
      type: new GraphQLList(memberType.type),
    }
  }
}

module.exports = GraphQLTypeArray
