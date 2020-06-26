import {FieldString} from '@baseplate/validator'
import {GraphQLNonNull, GraphQLString} from 'graphql'

export default class GraphQLFieldString extends FieldString.FieldHandler {
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
