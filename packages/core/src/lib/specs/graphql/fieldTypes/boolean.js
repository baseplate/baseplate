const {GraphQLBoolean, GraphQLNonNull} = require('graphql')
const {types} = require('@baseplate/validator')

class GraphQLTypeBoolean extends types.primitives.boolean {
  getGraphQLInputType() {
    const type = this.options.required
      ? GraphQLNonNull(GraphQLBoolean)
      : GraphQLBoolean

    return {
      type,
    }
  }

  getGraphQLOutputType() {
    return {
      type: GraphQLBoolean,
    }
  }
}

module.exports = GraphQLTypeBoolean
