const {GraphQLFloat, GraphQLNonNull} = require('graphql')
const TypeNumber = require('../../../../packages/validator/fieldTypes/number')

class GraphQLTypeNumber extends TypeNumber {
  getGraphQLInputType() {
    const type = this.options.required
      ? GraphQLNonNull(GraphQLFloat)
      : GraphQLFloat

    return {
      type
    }
  }

  getGraphQLOutputType() {
    return {
      type: GraphQLFloat
    }
  }
}

module.exports = GraphQLTypeNumber
