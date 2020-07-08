import {camelize} from 'inflected'
import {FieldMixed} from '@baseplate/validator'
import type GraphQL from 'graphql'

export default class CoreFieldMixed extends FieldMixed.FieldHandler {
  typeName: string

  constructor({options, path}: FieldMixed.ConstructorParameters) {
    super({options, path})

    this.options = options
    this.typeName = camelize(`Mixed_${path.join('_')}`)
  }

  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    const type = new graphql.GraphQLScalarType({
      name: this.typeName + 'Input',
      serialize: null,
    })

    return {
      type: this.options.required ? graphql.GraphQLNonNull(type) : type,
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
