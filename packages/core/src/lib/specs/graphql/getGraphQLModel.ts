import {camelize} from 'inflected'
import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLResolveInfo,
  FieldNode,
} from 'graphql'

import {ForbiddenError, UnauthorizedError} from '../../errors'
import AccessModel from '../../models/access'
import Context from '../../context'
import FieldSet from '../../fieldSet'
import GenericModel from '../../model/base'
import GraphQLDeleteResponse from './deleteResponse'
import GraphQLError from './error'
import QueryFilter from '../../queryFilter'

interface Mutation {
  type: any
  args: object
  resolve: Function
}

interface Query {
  type: any
  args: object
  resolve: Function
}

export default function getGraphQLModel(
  Model: typeof GenericModel,
  Access: typeof AccessModel
) {
  const GraphQLModel = class extends Model {
    static getGraphQLMutations() {
      if (typeof this.schema.getGraphQLInputFields !== 'function') {
        return
      }

      const inputFields = this.schema.getGraphQLInputFields()
      const mutations: Record<string, Mutation> = {}

      if (this.settings.interfaces.graphQLCreateMutation) {
        const mutationName = camelize(`create_${this.handle}`, false)

        mutations[mutationName] = {
          type: this.schema.graphQLType,
          args: inputFields,
          resolve: async (_root: any, fields: object, context: Context) => {
            try {
              const entry = await this.create(fields, {
                context,
                user: context.user,
              })

              return entry.toObject({includeModelInstance: true})
            } catch (error) {
              throw new GraphQLError(error)
            }
          },
        }
      }

      if (this.settings.interfaces.graphQLDeleteMutation) {
        const mutationName = camelize(`delete_${this.handle}`, false)

        mutations[mutationName] = {
          type: GraphQLDeleteResponse,
          args: {_id: {type: GraphQLNonNull(GraphQLID)}},
          resolve: async (
            _root: any,
            {_id: id}: {_id: string},
            context: Context
          ) => {
            try {
              const access = await Access.getAccess({
                accessType: 'delete',
                modelName: this.handle,
                user: context.user,
              })

              if (access.toObject() === false) {
                throw context.user
                  ? new ForbiddenError()
                  : new UnauthorizedError()
              }

              const {deleteCount} = await this.deleteOneById({id})

              return {
                deleteCount,
              }
            } catch (error) {
              throw new GraphQLError(error)
            }
          },
        }
      }

      if (this.settings.interfaces.graphQLUpdateMutation) {
        const mutationName = camelize(`update_${this.handle}`, false)

        mutations[mutationName] = {
          type: this.schema.graphQLType,
          args: {
            ...inputFields,
            _id: {type: GraphQLNonNull(GraphQLID)},
          },
          resolve: async (
            _root: any,
            {_id: id, ...update}: Record<string, any>,
            context: Context
          ) => {
            try {
              const entry = await this.updateOneById({
                context,
                id,
                update,
                user: context.user,
              })

              return entry.toObject({includeModelInstance: true})
            } catch (error) {
              throw new GraphQLError(error)
            }
          },
        }
      }

      return mutations
    }

    static getGraphQLQueries() {
      const queries: Record<string, Query> = {}
      const type = this.schema.graphQLType

      if (!type) return

      // Plural field: retrieves a list of entries.
      if (this.settings.interfaces.graphQLPluralQuery) {
        const queryName = camelize(this.handlePlural)

        queries[queryName] = {
          type: new GraphQLList(type),
          args: this.schema.getGraphQLQueryFilters(),
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
              const {entries} = await this.find({
                context,
                fieldSet: new FieldSet(requestedFields),
                filter: QueryFilter.parse(args, '_'),
                user: context.user,
              })

              return entries.map((entry: GenericModel) =>
                entry.toObject({includeModelInstance: true})
              )
            } catch (error) {
              throw new GraphQLError(error)
            }
          },
        }
      }

      // Singular field: retrieves a single entry.
      if (this.settings.interfaces.graphQLSingularQuery) {
        const queryName = camelize(this.handle)

        queries[queryName] = {
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
              const access = await Access.getAccess({
                accessType: 'read',
                modelName: this.handle,
                user: context.user,
              })
              const entry = await this.findOneById({
                context,
                fieldSet: FieldSet.intersect(
                  new FieldSet(requestedFields),
                  access.fields
                ),
                filter: access.filter,
                id,
              })

              return entry && entry.toObject({includeModelInstance: true})
            } catch (error) {
              throw new GraphQLError(error)
            }
          },
        }
      }

      return queries
    }
  }

  return Object.defineProperty(GraphQLModel, 'name', {
    value: Model.name,
  })
}
