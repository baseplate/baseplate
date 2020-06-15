const {camelize} = require('inflected')
const {GraphQLID, GraphQLList, GraphQLNonNull} = require('graphql')

const {ForbiddenError, UnauthorizedError} = require('../../errors')
const {default: FieldSet} = require('../../fieldSet')
const GraphQLDeleteResponse = require('./deleteResponse')
const GraphQLError = require('./error')
const {default: QueryFilter} = require('../../queryFilter')

module.exports = function getGraphQLModel({Access, Model}) {
  const GraphQLModel = class extends Model {
    static getGraphQLMutations() {
      if (typeof this.schema.getGraphQLInputFields !== 'function') {
        return
      }

      const inputFields = this.schema.getGraphQLInputFields()
      const mutations = {}

      if (this.settings.interfaces.graphQLCreateMutation) {
        const mutationName = camelize(`create_${this.handle}`, false)

        mutations[mutationName] = {
          type: this.schema.graphQLType,
          args: inputFields,
          resolve: async (_root, fields, context) => {
            try {
              const access = await Access.getAccess({
                accessType: 'create',
                modelName: this.handle,
                user: context.user,
              })

              if (access.toObject() === false) {
                throw context.user
                  ? new ForbiddenError()
                  : new UnauthorizedError()
              }

              const entry = new this(fields)

              await entry.save()

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
          resolve: async (_root, {_id: id}, context) => {
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
          resolve: async (_root, fields, context) => {
            try {
              const access = await Access.getAccess({
                accessType: 'update',
                modelName: this.handle,
                user: context.user,
              })

              if (access.toObject() === false) {
                throw context.user
                  ? new ForbiddenError()
                  : new UnauthorizedError()
              }

              const entry = new this(fields)

              await entry.save()

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
      const queries = {}
      const type = this.schema.graphQLType

      if (!type) return

      // Plural field: retrieves a list of entries.
      if (this.settings.interfaces.graphQLPluralQuery) {
        const queryName = camelize(this.handlePlural)

        queries[queryName] = {
          type: new GraphQLList(type),
          args: this.schema.getGraphQLQueryFilters(),
          resolve: async (_, args, context, info) => {
            try {
              const requestedFields = info.fieldNodes[0].selectionSet.selections.map(
                (selection) => selection.name.value
              )
              const access = await Access.getAccess({
                accessType: 'read',
                modelName: this.handle,
                user: context.user,
              })
              const filter = QueryFilter.parse(args, '_').intersectWith(
                access.filter
              )
              const {entries} = await this.find({
                fieldSet: FieldSet.intersect(requestedFields, access.fields),
                filter,
              })

              return entries.map((entry) =>
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
          resolve: async (_, {_id: id}, context, info) => {
            try {
              const requestedFields = info.fieldNodes[0].selectionSet.selections.map(
                (selection) => selection.name.value
              )
              const access = await Access.getAccess({
                accessType: 'read',
                modelName: this.handle,
                user: context.user,
              })
              const entry = await this.findOneById({
                fieldSet: FieldSet.intersect(requestedFields, access.fields),
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
