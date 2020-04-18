const {GraphQLBoolean, GraphQLNonNull} = require('graphql')
const TypeBoolean = require('../../../../packages/validator/fieldTypes/boolean')

class GraphQLTypeBoolean extends TypeBoolean {
  getGraphQLInputType() {
    const type = this.options.required
      ? GraphQLNonNull(GraphQLBoolean)
      : GraphQLBoolean

    return {
      type
    }
  }

  getGraphQLOutputType() {
    return {
      type: GraphQLBoolean
    }
  }
}

module.exports = GraphQLTypeBoolean
