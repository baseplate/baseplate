const {GraphQLNonNull, GraphQLString} = require('graphql')
const {types} = require('@baseplate/validator')

class GraphQLTypeString extends types.primitives.string {
  getGraphQLInputType() {
    const type = this.options.required
      ? GraphQLNonNull(GraphQLString)
      : GraphQLString

    return {
      type,
    }
  }

  getGraphQLOutputType() {
    return {
      type: GraphQLString,
    }
  }
}

module.exports = GraphQLTypeString
