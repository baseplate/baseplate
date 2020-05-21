const {GraphQLList} = require('graphql')
const TypeArray = require('../../../../../../packages/validator/fieldTypes/array')

class GraphQLTypeArray extends TypeArray {
  constructor({memberType, ...options}) {
    super(options)

    this.memberType = memberType
  }

  getGraphQLInputType({fieldName}) {
    const memberType = this.memberType.getGraphQLInputType({fieldName})

    return {
      type: new GraphQLList(memberType.type)
    }
  }

  getGraphQLOutputType({fieldName}) {
    const memberType = this.memberType.getGraphQLOutputType({fieldName})

    return {
      type: new GraphQLList(memberType.type)
    }
  }
}

module.exports = GraphQLTypeArray
