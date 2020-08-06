import {camelize} from 'inflected'
import * as graphql from 'graphql'
import {
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLString,
  FieldNode,
} from 'graphql'

import {FieldHandler} from '../../fieldTypes'
import {FieldHandlers, NestedObjectMarker} from '../../schema'
import {ForbiddenError, UnauthorizedError} from '../../errors'
import AccessModel from '../../internalModels/access'
import type BaseModel from '../../model/base'
import Context from '../../context'
import FieldSet from '../../fieldSet'
import GraphQLDeleteResponse from './deleteResponse'
import GraphQLError from './error'
import GraphQLQueryFilterType from './queryFilter'
import QueryFilter from '../../queryFilter'

export interface Mutation {
  type: any
  args: object
  resolve: Function
}

export interface Query {
  type: any
  args: object
  resolve: Function
}

function dateResolver(
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

function isHandlerNestedObject(
  input: FieldHandler | NestedObjectMarker
): input is NestedObjectMarker {
  return Boolean(input && (input as NestedObjectMarker).__nestedObjectId)
}

function getInputFields(Model: typeof BaseModel) {
  if (Model.base$graphQL.inputFields) {
    return Model.base$graphQL.inputFields
  }

  const fields = getTypesFromFieldHandlers(
    Model.base$schema.fieldHandlers,
    Model,
    'input'
  )

  Model.base$graphQL.inputFields = {
    ...fields,
    ...getTypesFromVirtuals(Model),
  }

  return Model.base$graphQL.inputFields
}

function getInputFieldsWithRequiredConstraints(Model: typeof BaseModel) {
  const fields = getInputFields(Model)
  const fieldsWithRequiredConstraints = Object.keys(fields).reduce(
    (result, name) => {
      const {options} = Model.base$schema.fields[name] || {}

      return {
        ...result,
        [name]: {
          type: options.required
            ? GraphQLNonNull(fields[name].type)
            : fields[name].type,
        },
      }
    },
    {}
  )

  return fieldsWithRequiredConstraints
}

function getMutations(Model: typeof BaseModel) {
  if (Model.base$graphQL.mutations) {
    return Model.base$graphQL.mutations
  }

  const entryType = getObjectType(Model)
  const mutations: Map<string, Mutation> = new Map()

  if (Model.base$interfaces.graphQLCreateResource) {
    const mutationName = camelize(`create_${Model.base$handle}`, false)
    const createInputType = new GraphQLInputObjectType({
      name: camelize(`create_${Model.base$handle}_input_type`),
      fields: getInputFieldsWithRequiredConstraints(Model),
    })

    mutations.set(mutationName, {
      type: entryType,
      args: {
        data: {
          type: GraphQLNonNull(createInputType),
        },
      },
      resolve: async (_root: any, {data}: {data: object}, context: Context) => {
        try {
          const entry = await Model.create(data, {
            context,
            user: context.get('base$user'),
          })

          return entry.toObject({includeModelInstance: true})
        } catch (error) {
          throw new GraphQLError(error)
        }
      },
    })
  }

  if (Model.base$interfaces.graphQLDeleteResource) {
    const mutationName = camelize(`delete_${Model.base$handle}`, false)

    mutations.set(mutationName, {
      type: GraphQLDeleteResponse,
      args: {id: {type: GraphQLNonNull(GraphQLID)}},
      resolve: async (_root: any, {id}: {id: string}, context: Context) => {
        try {
          const {deleteCount} = await Model.deleteOneById({
            context,
            id,
            user: context.get('base$user'),
          })

          return {
            deleteCount,
          }
        } catch (error) {
          throw new GraphQLError(error)
        }
      },
    })
  }

  if (Model.base$interfaces.graphQLUpdateResource) {
    const mutationName = camelize(`update_${Model.base$handle}`, false)
    const updateInputType = new GraphQLInputObjectType({
      name: camelize(`update_${Model.base$handle}_update_type`),
      fields: getInputFields(Model),
    })

    mutations.set(mutationName, {
      type: entryType,
      args: {
        id: {type: GraphQLNonNull(GraphQLID)},
        update: {type: GraphQLNonNull(updateInputType)},
      },
      resolve: async (
        _root: any,
        {id, update}: {id: string; update: Record<string, any>},
        context: Context
      ) => {
        try {
          const entry = await Model.updateOneById({
            context,
            id,
            update,
            user: context.get('base$user'),
          })

          return entry.toObject({includeModelInstance: true})
        } catch (error) {
          throw new GraphQLError(error)
        }
      },
    })
  }

  if (Model.base$interfaces.graphQLUpdateResources) {
    const mutationName = camelize(`update_${Model.base$handlePlural}`, false)
    const filterInputType = new GraphQLInputObjectType({
      name: camelize(`update_${Model.base$handlePlural}_filter_type`),
      fields: {
        ...getInputFields(Model),
        _id: {type: GraphQLID},
      },
    })
    const updateInputType = new GraphQLInputObjectType({
      name: camelize(`update_${Model.base$handlePlural}_update_type`),
      fields: getInputFields(Model),
    })

    mutations.set(mutationName, {
      type: new GraphQLList(entryType),
      args: {
        filter: {type: GraphQLNonNull(filterInputType)},
        update: {type: GraphQLNonNull(updateInputType)},
      },
      resolve: async (
        _root: any,
        {
          filter,
          update,
        }: {filter: Record<string, any>; update: Record<string, any>},
        context: Context
      ) => {
        try {
          const entries = await Model.update({
            context,
            filter: QueryFilter.parse(filter, '_'),
            update,
            user: context.get('base$user'),
          })

          return entries.map((entry: BaseModel) =>
            entry.toObject({includeModelInstance: true})
          )
        } catch (error) {
          throw new GraphQLError(error)
        }
      },
    })
  }

  Model.base$graphQL.mutations = mutations

  return mutations
}

function getObjectType(Model: typeof BaseModel) {
  if (Model.base$graphQL.objectType) {
    return Model.base$graphQL.objectType
  }

  const objectType = new GraphQLObjectType({
    fields: () => getOutputFields(Model),
    isTypeOf: (value) => {
      return (
        value.__model &&
        value.__model.constructor.base$handle === Model.base$handle
      )
    },
    name: camelize(Model.base$handle),
  })

  if (Model.base$graphQL) {
    Model.base$graphQL.objectType = objectType
  }

  return objectType
}

function getOutputFields(Model: typeof BaseModel) {
  const fields = {
    _id: {type: GraphQLID},
    _createdAt: {
      type: GraphQLString,
      resolve: dateResolver,
    },
    _updatedAt: {
      type: GraphQLString,
      resolve: dateResolver,
    },
    ...getTypesFromFieldHandlers(
      Model.base$schema.fieldHandlers,
      Model,
      'output'
    ),
    ...getTypesFromVirtuals(Model),
  }

  return fields
}

function getQueries(Model: typeof BaseModel) {
  if (Model.base$graphQL && Model.base$graphQL.queries) {
    return Model.base$graphQL.queries
  }

  const queries: Map<string, Query> = new Map()
  const type = getObjectType(Model)

  if (!type) return queries

  // Plural field: retrieves a list of entries.
  if (Model.base$interfaces.graphQLFindResources) {
    const queryName = camelize(Model.base$handlePlural)

    queries.set(queryName, {
      type: new GraphQLList(type),
      args: getQueryFilters(Model),
      resolve: async (
        _root: any,
        args: object,
        context: Context,
        info: GraphQLResolveInfo
      ) => {
        try {
          const requestedFields = info.fieldNodes[0].selectionSet.selections
            .map((selection) =>
              (selection as FieldNode).name
                ? (selection as FieldNode).name.value
                : null
            )
            .filter(Boolean)
          const {entries} = await Model.find({
            context,
            fieldSet: new FieldSet(requestedFields),
            filter: QueryFilter.parse(args, '_'),
            user: context.get('base$user'),
          })

          return entries.map((entry: BaseModel) =>
            entry.toObject({includeModelInstance: true})
          )
        } catch (error) {
          throw new GraphQLError(error)
        }
      },
    })
  }

  // Singular field: retrieves a single entry.
  if (Model.base$interfaces.graphQLFindResource) {
    const queryName = camelize(Model.base$handle)

    queries.set(queryName, {
      type,
      args: {
        _id: {type: GraphQLNonNull(GraphQLID)},
      },
      resolve: async (
        _root: any,
        {_id: id}: {_id: string},
        context: Context,
        info: GraphQLResolveInfo
      ) => {
        try {
          const requestedFields = info.fieldNodes[0].selectionSet.selections
            .map((selection) =>
              (selection as FieldNode).name
                ? (selection as FieldNode).name.value
                : null
            )
            .filter(Boolean)
          const entry = await Model.findOneById({
            context,
            fieldSet: new FieldSet(requestedFields),
            id,
            user: context.get('base$user'),
          })

          return entry && entry.toObject({includeModelInstance: true})
        } catch (error) {
          throw new GraphQLError(error)
        }
      },
    })
  }

  Model.base$graphQL.queries = queries

  return queries
}

function getQueryFilters(Model: typeof BaseModel) {
  const queryFilters = Object.keys(Model.base$schema.fields).reduce(
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

function getTypesFromFieldHandlers(
  handlers: FieldHandlers,
  Model: typeof BaseModel,
  type: 'input' | 'output'
): Record<string, {type: any}> {
  const functionName =
    type === 'input' ? 'getGraphQLInputType' : 'getGraphQLOutputType'
  const ObjectType =
    type === 'input' ? GraphQLInputObjectType : GraphQLObjectType
  const fields = Object.entries(handlers).reduce((fields, [name, handler]) => {
    if (isHandlerNestedObject(handler)) {
      const {__nestedObjectId, ...nestedFields} = handler
      const nestedGraphQLTypes = getTypesFromFieldHandlers(
        <Record<string, FieldHandler>>nestedFields,
        Model,
        type
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
            name: __nestedObjectId + (type === 'input' ? 'Input' : 'Output'),
          }),
        },
      }
    }

    if (typeof handler[functionName] === 'function') {
      return {
        ...fields,
        [name]: handler[functionName](graphql, name, Model),
      }
    }

    return fields
  }, {})

  return {...fields}
}

function getTypesFromVirtuals(
  Model: typeof BaseModel
): Record<string, {type: GraphQLScalarType}> {
  const {virtuals} = Model.base$schema
  const virtualTypes = Object.keys(virtuals).reduce((result, name) => {
    const virtualName = camelize(`${Model.base$handle}_Virtual`)
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

export {getMutations, getObjectType, getQueries}
