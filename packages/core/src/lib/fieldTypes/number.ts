import {FieldNumber} from '@baseplate/validator'
import type GraphQL from 'graphql'

export default class CoreFieldNumber extends FieldNumber.FieldHandler {
  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    const type = this.options.required
      ? graphql.GraphQLNonNull(graphql.GraphQLFloat)
      : graphql.GraphQLFloat

    return {
      type,
    }
  }

  getGraphQLOutputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLFloat,
    }
  }
}
