import {FieldConstructorParameters, types} from '@baseplate/validator'
import type GraphQL from 'graphql'

export default class CoreFieldArray extends types.FieldArray {
  memberType: any

  constructor(props: FieldConstructorParameters) {
    super(props)

    this.memberType = props.children
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
