import {FieldNumber} from '@baseplate/validator'
import {GraphQLFloat, GraphQLNonNull} from 'graphql'

export default class GraphQLFieldNumber extends FieldNumber.FieldHandler {
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
