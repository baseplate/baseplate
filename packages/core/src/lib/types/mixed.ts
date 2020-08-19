import {camelize} from 'inflected'
import {FieldConstructorParameters, types} from '@baseplate/schema'
import type GraphQL from 'graphql'

export default class CoreFieldMixed extends types.FieldMixed {
  typeName: string

  constructor(props: FieldConstructorParameters) {
    super(props)

    this.typeName = camelize(`Mixed_${props.path.join('_')}`)
  }

  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: new graphql.GraphQLScalarType({
        name: this.typeName + 'Input',
        serialize: null,
      }),
    }
  }

  getGraphQLOutputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: new graphql.GraphQLScalarType({
        name: this.typeName + 'Output',
        serialize: null,
      }),
    }
  }
}
