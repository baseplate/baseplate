import {FieldArray} from '@baseplate/validator'
import type GraphQL from 'graphql'

interface ConstructorParameters extends FieldArray.ConstructorParameters {
  memberType: any
}

export default class CoreFieldArray extends FieldArray.FieldHandler {
  memberType: any

  constructor({memberType, ...options}: ConstructorParameters) {
    super(options)

    this.memberType = memberType
  }

  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    const memberType = this.memberType.getGraphQLInputType({fieldName})

    return {
      type: new graphql.GraphQLList(memberType.type),
    }
  }

  getGraphQLOutputType(graphql: typeof GraphQL, fieldName: string) {
    const memberType = this.memberType.getGraphQLOutputType({fieldName})

    return {
      type: new graphql.GraphQLList(memberType.type),
    }
  }
}
