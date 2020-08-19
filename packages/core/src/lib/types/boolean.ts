import {types} from '@baseplate/schema'
import type GraphQL from 'graphql'

export default class CoreFieldBoolean extends types.FieldBoolean {
  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    const type = this.options.required
      ? graphql.GraphQLNonNull(graphql.GraphQLBoolean)
      : graphql.GraphQLBoolean

    return {
      type,
    }
  }

  getGraphQLOutputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLBoolean,
    }
  }
}
