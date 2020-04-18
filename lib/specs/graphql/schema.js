const {
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLString
} = require('graphql')

const capitalizeString = require('../../utils/capitalizeString')
const fieldTypes = require('./fieldTypes/')
const GraphQLQueryFilterType = require('./queryFilter')
const Schema = require('../../schema')

class GraphQLSchema extends Schema {
  constructor(props) {
    super({...props, fieldTypes})

    this.virtualTypes = this.getGraphQLTypesFromVirtuals(this.virtuals)
  }

  static graphQLDateResolver(root, _args, _context, info) {
    const timestamp = root[info.fieldName]

    if (!timestamp) return null

    const date = new Date(timestamp)

    return date.toISOString()
  }

  getGraphQLInputFields() {
    const fields = this.getGraphQLTypesFromHandlers({
      handlers: this.fieldHandlers,
      isInput: true
    })

    return {
      ...fields,
      ...this.virtualTypes
    }
  }

  getGraphQLOutputFields() {
    const fields = {
      _id: {type: GraphQLID},
      _createdAt: {
        type: GraphQLString,
        resolve: GraphQLSchema.graphQLDateResolver
      },
      _updatedAt: {
        type: GraphQLString,
        resolve: GraphQLSchema.graphQLDateResolver
      },
      ...this.getGraphQLTypesFromHandlers({
        handlers: this.fieldHandlers,
        isInput: false
      }),
      ...this.virtualTypes
    }

    return fields
  }

  getGraphQLQueryFilters() {
    const queryFilters = Object.keys(this.fields).reduce(
      (queryFilters, fieldName) => {
        return {
          ...queryFilters,
          [fieldName]: {type: GraphQLQueryFilterType}
        }
      },
      {}
    )

    return queryFilters
  }

  getGraphQLTypesFromVirtuals(virtuals) {
    const virtualTypes = Object.keys(virtuals).reduce((result, name) => {
      const virtualName =
        capitalizeString(this.modelName) + capitalizeString(name) + 'Virtual'
      const type = new GraphQLScalarType({
        name: virtualName
      })

      return {
        ...result,
        [name]: {
          type
        }
      }
    }, {})

    return virtualTypes
  }

  getGraphQLTypesFromHandlers({handlers, isInput}) {
    const functionName = isInput
      ? 'getGraphQLInputType'
      : 'getGraphQLOutputType'
    const ObjectType = isInput ? GraphQLInputObjectType : GraphQLObjectType
    const fields = Object.entries(handlers).reduce(
      (fields, [name, handler]) => {
        if (handler.__nestedObjectId) {
          const {__nestedObjectId, ...nestedFields} = handler
          const nestedGraphQLTypes = this.getGraphQLTypesFromHandlers({
            handlers: nestedFields,
            isInput
          })

          // (!) TO DO: What do we do here?
          if (Object.keys(nestedGraphQLTypes).length === 0) {
            return fields
          }

          return {
            ...fields,
            [name]: {
              type: new ObjectType({
                fields: nestedGraphQLTypes,
                name: __nestedObjectId + (isInput ? 'Input' : 'Output')
              })
            }
          }
        }

        if (typeof handler[functionName] === 'function') {
          return {
            ...fields,
            [name]: handler[functionName]({
              fieldName: name,
              modelName: this.modelName
            })
          }
        }

        return fields
      },
      {}
    )

    return {...fields}
  }
}

module.exports = GraphQLSchema
