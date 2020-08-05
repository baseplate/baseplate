import {FieldString} from '@baseplate/validator'
import type GraphQL from 'graphql'

export default class CoreFieldString extends FieldString.FieldHandler {
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
