import {types} from '@baseplate/schema'
import type GraphQL from 'graphql'

export default class CoreFieldNumber extends types.FieldNumber {
  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLFloat,
    }
  }

  getGraphQLOutputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLFloat,
    }
  }
}
