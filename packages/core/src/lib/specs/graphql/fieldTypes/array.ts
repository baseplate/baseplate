import {FieldArray} from '@baseplate/validator'
import {GraphQLList} from 'graphql'

interface ConstructorParameters extends FieldArray.ConstructorParameters {
  memberType: any
}

export default class GraphQLFieldArray extends FieldArray.FieldHandler {
  memberType: any

  constructor({memberType, ...options}: ConstructorParameters) {
    super(options)

    this.memberType = memberType
  }

  getGraphQLInputType({fieldName}: {fieldName: string}) {
    const memberType = this.memberType.getGraphQLInputType({fieldName})

    return {
      type: new GraphQLList(memberType.type),
    }
  }

  getGraphQLOutputType({fieldName}: {fieldName: string}) {
    const memberType = this.memberType.getGraphQLOutputType({fieldName})

    return {
      type: new GraphQLList(memberType.type),
    }
  }
}
