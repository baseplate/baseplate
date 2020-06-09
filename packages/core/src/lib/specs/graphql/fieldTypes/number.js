const {GraphQLFloat, GraphQLNonNull} = require('graphql')
const {types} = require('@baseplate/validator')

class GraphQLTypeNumber extends types.primitives.number {
  getGraphQLInputType() {
    const type = this.options.required
      ? GraphQLNonNull(GraphQLFloat)
      : GraphQLFloat

    return {
      type,
    }
  }

  getGraphQLOutputType() {
    return {
      type: GraphQLFloat,
    }
  }
}

module.exports = GraphQLTypeNumber
