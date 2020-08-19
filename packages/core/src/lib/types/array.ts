import {types} from '@baseplate/schema'
import type GraphQL from 'graphql'

export default class CoreFieldArray extends types.FieldArray {
  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    const memberType = this.children[0].getGraphQLInputType(graphql, fieldName)

    return {
      type: new graphql.GraphQLList(memberType.type),
    }
  }

  getGraphQLOutputType(graphql: typeof GraphQL, fieldName: string) {
    const memberType = this.children[0].getGraphQLOutputType(graphql, fieldName)

    return {
      type: new graphql.GraphQLList(memberType.type),
    }
  }
}
