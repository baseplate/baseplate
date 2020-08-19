import {types} from '@baseplate/schema'
import type GraphQL from 'graphql'

export default class CoreFieldString extends types.FieldString {
  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLString,
    }
  }

  getGraphQLOutputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLString,
    }
  }
}
