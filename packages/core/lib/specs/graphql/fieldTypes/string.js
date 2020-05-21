const {GraphQLNonNull, GraphQLString} = require('graphql')
const TypeString = require('../../../../../../packages/validator/fieldTypes/string')

class GraphQLTypeString extends TypeString {
  getGraphQLInputType() {
    const type = this.options.required
      ? GraphQLNonNull(GraphQLString)
      : GraphQLString

    return {
      type
    }
  }

  getGraphQLOutputType() {
    return {
      type: GraphQLString
    }
  }
}

module.exports = GraphQLTypeString
