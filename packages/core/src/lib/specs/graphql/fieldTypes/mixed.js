const {camelize} = require('inflected')
const {GraphQLNonNull, GraphQLScalarType} = require('graphql')
const {types} = require('@baseplate/validator')

class GraphQLTypeMixed extends types.primitives.mixed {
  constructor({options, path}) {
    super({options, path})

    this.options = options
    this.typeName = camelize(`Mixed_${path.join('_')}`)
  }

  getGraphQLInputType() {
    const type = new GraphQLScalarType({
      name: this.typeName + 'Input',
    })

    return {
      type: this.options.required ? GraphQLNonNull(type) : type,
    }
  }

  getGraphQLOutputType() {
    return {
      type: new GraphQLScalarType({
        name: this.typeName + 'Output',
      }),
    }
  }
}

module.exports = GraphQLTypeMixed
