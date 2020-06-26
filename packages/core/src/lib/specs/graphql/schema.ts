import {camelize} from 'inflected'
import {
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLString,
} from 'graphql'

import Context from '../../context'
import fieldTypes, {GraphQLField, GraphQLFieldHandler} from './fieldTypes/'
import GraphQLQueryFilterType from './queryFilter'
import Schema, {
  NestedObjectMarker,
  SchemaConstructorParameters,
  Virtual,
} from '../../schema'

export default class GraphQLSchema extends Schema {
  fieldHandlers: Record<string, GraphQLField>
  graphQLType: GraphQLObjectType
  virtualTypes: Record<string, {type: GraphQLScalarType}>

  constructor(props: SchemaConstructorParameters) {
    super({...props, fieldTypes})

    this.graphQLType = this.getGraphQLType()
    this.virtualTypes = this.getGraphQLTypesFromVirtuals(this.virtuals)
  }

  static graphQLDateResolver(
    root: any,
    args: object,
    context: Context,
    info: GraphQLResolveInfo
  ) {
    const timestamp = root[info.fieldName]

    if (!timestamp) return null

    const date = new Date(timestamp)

    return date.toISOString()
  }

  getGraphQLInputFields() {
    const fields = this.getGraphQLTypesFromHandlers(this.fieldHandlers, true)

    return {
      ...fields,
      ...this.virtualTypes,
    }
  }

  getGraphQLOutputFields() {
    const fields = {
      _id: {type: GraphQLID},
      _createdAt: {
        type: GraphQLString,
        resolve: GraphQLSchema.graphQLDateResolver,
      },
      _updatedAt: {
        type: GraphQLString,
        resolve: GraphQLSchema.graphQLDateResolver,
      },
      ...this.getGraphQLTypesFromHandlers(this.fieldHandlers, false),
      ...this.virtualTypes,
    }

    return fields
  }

  getGraphQLQueryFilters() {
    const queryFilters = Object.keys(this.fields).reduce(
      (queryFilters, fieldName) => {
        return {
          ...queryFilters,
          [fieldName]: {type: GraphQLQueryFilterType},
        }
      },
      {}
    )

    return queryFilters
  }

  getGraphQLType() {
    return new GraphQLObjectType({
      fields: this.getGraphQLOutputFields.bind(this),
      isTypeOf: (value) => {
        return value.__model && value.__model.constructor.schema === this
      },
      name: camelize(this.name),
    })
  }

  getGraphQLTypesFromVirtuals(virtuals: Record<string, Virtual>) {
    const virtualTypes: Record<string, {type: GraphQLScalarType}> = Object.keys(
      virtuals
    ).reduce((result, name) => {
      const virtualName = camelize(`${this.name}_Virtual`)
      const type = new GraphQLScalarType({
        name: virtualName,
        serialize: null,
      })

      return {
        ...result,
        [name]: {
          type,
        },
      }
    }, {})

    return virtualTypes
  }

  getGraphQLTypesFromHandlers(
    handlers: Record<string, GraphQLField | NestedObjectMarker>,
    isInput: boolean
  ): Record<string, {type: any}> {
    const functionName = isInput
      ? 'getGraphQLInputType'
      : 'getGraphQLOutputType'
    const ObjectType = isInput ? GraphQLInputObjectType : GraphQLObjectType
    const fields = Object.entries(handlers).reduce(
      (fields, [name, handler]) => {
        if (this.isHandlerNestedObject(handler)) {
          const {__nestedObjectId, ...nestedFields} = handler
          const nestedGraphQLTypes = this.getGraphQLTypesFromHandlers(
            <Record<string, GraphQLField>>nestedFields,
            isInput
          )

          // (!) TO DO: What do we do here?
          if (Object.keys(nestedGraphQLTypes).length === 0) {
            return fields
          }

          return {
            ...fields,
            [name]: {
              type: new ObjectType({
                fields: nestedGraphQLTypes,
                name: __nestedObjectId + (isInput ? 'Input' : 'Output'),
              }),
            },
          }
        }

        if (typeof handler[functionName] === 'function') {
          return {
            ...fields,
            [name]: handler[functionName]({
              fieldName: name,
              modelName: this.name,
            }),
          }
        }

        return fields
      },
      {}
    )

    return {...fields}
  }

  isHandlerNestedObject(
    handler: GraphQLField | NestedObjectMarker
  ): handler is NestedObjectMarker {
    return (handler as NestedObjectMarker).__nestedObjectId !== undefined
  }
}
