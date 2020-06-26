import {FieldBoolean} from '@baseplate/validator'
import {GraphQLBoolean, GraphQLNonNull} from 'graphql'

export default class GraphQLFieldBoolean extends FieldBoolean.FieldHandler {
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
