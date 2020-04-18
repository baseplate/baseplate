const {GraphQLNonNull, GraphQLScalarType} = require('graphql')
const capitalizeString = require('../../../utils/capitalizeString')
const TypeMixed = require('../../../../packages/validator/fieldTypes/mixed')

class GraphQLTypeMixed extends TypeMixed {
  constructor({options, path}) {
    super({options, path})

    this.options = options
    this.typeName = 'Mixed' + path.map(item => capitalizeString(item)).join('')
  }

  getGraphQLInputType() {
    const type = new GraphQLScalarType({
      name: this.typeName + 'Input'
    })

    return {
      type: this.options.required ? GraphQLNonNull(type) : type
    }
  }

  getGraphQLOutputType() {
    return {
      type: new GraphQLScalarType({
        name: this.typeName + 'Output'
      })
    }
  }
}

module.exports = GraphQLTypeMixed
