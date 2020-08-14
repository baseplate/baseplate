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
import {FieldHandler} from '@baseplate/validator'

import {GraphQLFieldHandler} from './fieldType'
import type BaseModel from '../../model/base'
import Context from '../../context'
import FieldSet from '../../fieldSet'
import GraphQLDeleteResponse from './deleteResponse'
import GraphQLError from './error'
import GraphQLQueryFilterType from './queryFilter'
import logger from '../../logger'
import QueryFilter from '../../queryFilter/'

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

function getInputFields(Model: typeof BaseModel) {
  if (Model.base$graphQL.inputFields) {
    return Model.base$graphQL.inputFields
  }

  const fields = getTypesFromFieldHandlers(
    Model.base$schema.handlers,
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
      const {options = {}} = Model.base$schema.handlers[name] || {}

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

  if (Model.base$interfacePaths.graphQLCreateResource) {
    const mutationName = Model.base$interfacePaths.graphQLCreateResource
    const createInputType = new GraphQLInputObjectType({
      name: `${mutationName}InputType`,
      fields: getInputFieldsWithRequiredConstraints(Model),
    })

    logger.debug('Adding GraphQL mutation: %s', mutationName, {
      model: Model.base$handle,
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

  if (Model.base$interfacePaths.graphQLDeleteResource) {
    const mutationName = Model.base$interfacePaths.graphQLDeleteResource

    logger.debug('Adding GraphQL mutation: %s', mutationName, {
      model: Model.base$handle,
    })

    mutations.set(mutationName, {
      type: GraphQLDeleteResponse,
      args: {id: {type: GraphQLNonNull(GraphQLID)}},
      resolve: async (_root: any, {id}: {id: string}, context: Context) => {
        try {
          const {deleteCount} = await Model.delete({
            context,
            filter: new QueryFilter({_id: id}),
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

  if (Model.base$interfacePaths.graphQLUpdateResource) {
    const mutationName = Model.base$interfacePaths.graphQLUpdateResource
    const updateInputType = new GraphQLInputObjectType({
      name: `${mutationName}UpdateType`,
      fields: getInputFields(Model),
    })

    logger.debug('Adding GraphQL mutation: %s', mutationName, {
      model: Model.base$handle,
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

  if (Model.base$interfacePaths.graphQLUpdateResources) {
    const mutationName = Model.base$interfacePaths.graphQLUpdateResources
    const filterInputType = new GraphQLInputObjectType({
      name: `Update${mutationName}FilterType`,
      fields: {
        ...getInputFields(Model),
        _id: {type: GraphQLID},
      },
    })
    const updateInputType = new GraphQLInputObjectType({
      name: `Update${mutationName}UpdateType`,
      fields: getInputFields(Model),
    })

    logger.debug('Adding GraphQL mutation: %s', mutationName, {
      model: Model.base$handle,
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
            filter: new QueryFilter(filter, '_'),
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
    ...getTypesFromFieldHandlers(Model.base$schema.handlers, Model, 'output'),
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
  if (Model.base$interfacePaths.graphQLFindResources) {
    const queryName = Model.base$interfacePaths.graphQLFindResources

    logger.debug('Adding GraphQL query: %s', queryName, {
      model: Model.base$handle,
    })

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
            filter: new QueryFilter(args, '_'),
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
  if (Model.base$interfacePaths.graphQLFindResource) {
    const queryName = Model.base$interfacePaths.graphQLFindResource

    logger.debug('Adding GraphQL query: %s', queryName, {
      model: Model.base$handle,
    })

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
          const entry = await Model.findOne({
            context,
            fieldSet: new FieldSet(requestedFields),
            filter: new QueryFilter({_id: id}),
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
  const queryFilters = Object.keys(Model.base$schema.handlers).reduce(
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
  handlers: Record<string, FieldHandler>,
  Model: typeof BaseModel,
  type: 'input' | 'output'
): Record<string, {type: any}> {
  const functionName =
    type === 'input' ? 'getGraphQLInputType' : 'getGraphQLOutputType'
  const fields = Object.entries(handlers).reduce((fields, [name, handler]) => {
    const graphQLHandler = handler as GraphQLFieldHandler

    if (typeof graphQLHandler[functionName] === 'function') {
      return {
        ...fields,
        [name]: graphQLHandler[functionName](graphql, name, Model),
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
