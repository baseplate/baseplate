import {camelize} from 'inflected'
import {GraphQLNonNull, GraphQLScalarType} from 'graphql'
import {FieldMixed} from '@baseplate/validator'

export default class GraphQLFieldMixed extends FieldMixed.FieldHandler {
  typeName: string

  constructor({options, path}: FieldMixed.ConstructorParameters) {
    super({options, path})

    this.options = options
    this.typeName = camelize(`Mixed_${path.join('_')}`)
  }

  getGraphQLInputType() {
    const type = new GraphQLScalarType({
      name: this.typeName + 'Input',
      serialize: null,
    })

    return {
      type: this.options.required ? GraphQLNonNull(type) : type,
    }
  }

  getGraphQLOutputType() {
    return {
      type: new GraphQLScalarType({
        name: this.typeName + 'Output',
        serialize: null,
      }),
    }
  }
}
