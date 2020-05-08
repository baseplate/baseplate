const {camelize} = require('inflected')
const {ForbiddenError, UnauthorizedError} = require('../../errors')
const {GraphQLID, GraphQLList, GraphQLNonNull} = require('graphql')

const FieldSet = require('../../fieldSet')
const GraphQLDeleteResponse = require('./deleteResponse')
const GraphQLError = require('./error')
const QueryFilter = require('../../queryFilter')

module.exports = function extendModelWithGraphQL({Access, Model}) {
  return Object.assign(Model, {
    dateResolver(root, _args, _context, info) {
      const timestamp = root[info.fieldName]

      if (!timestamp) return null

      const date = new Date(timestamp)

      return date.toISOString()
    },

    getGraphQLMutations() {
      if (typeof this.schema.getGraphQLInputFields !== 'function') {
        return
      }

      const inputFields = this.schema.getGraphQLInputFields()
      const mutations = {}

      if (this.graphQLRoutes.createMutation) {
        const mutationName = camelize(`create_${this.name}`, false)

        mutations[mutationName] = {
          type: this.schema.graphQLType,
          args: inputFields,
          resolve: async (_root, fields, context) => {
            try {
              const access = await Access.getAccess({
                accessType: 'create',
                modelName: this.schema.name,
                user: context.user
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
          }
        }
      }

      if (this.graphQLRoutes.deleteMutation) {
        const mutationName = camelize(`delete_${this.name}`, false)

        mutations[mutationName] = {
          type: GraphQLDeleteResponse,
          args: {_id: {type: GraphQLNonNull(GraphQLID)}},
          resolve: async (_root, {_id: id}, context) => {
            try {
              const access = await Access.getAccess({
                accessType: 'delete',
                modelName: this.schema.name,
                user: context.user
              })

              if (access.toObject() === false) {
                throw context.user
                  ? new ForbiddenError()
                  : new UnauthorizedError()
              }

              const {deleteCount} = await this.delete({id})

              return {
                deleteCount
              }
            } catch (error) {
              throw new GraphQLError(error)
            }
          }
        }
      }

      if (this.graphQLRoutes.updateMutation) {
        const mutationName = camelize(`update_${this.name}`, false)

        mutations[mutationName] = {
          type: this.schema.graphQLType,
          args: {
            ...inputFields,
            _id: {type: GraphQLNonNull(GraphQLID)}
          },
          resolve: async (_root, fields, context) => {
            try {
              const access = await Access.getAccess({
                accessType: 'update',
                modelName: this.schema.name,
                user: context.user
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
          }
        }
      }

      return mutations
    },

    getGraphQLQueries() {
      const queries = {}
      const type = this.schema.graphQLType

      if (!type) return

      // Plural field: retrieves a list of entries.
      if (this.graphQLRoutes.pluralQuery) {
        const queryName = camelize(this.plural)

        queries[queryName] = {
          type: new GraphQLList(type),
          args: this.schema.getGraphQLQueryFilters(),
          resolve: async (_, args, context, info) => {
            try {
              const requestedFields = info.fieldNodes[0].selectionSet.selections.map(
                selection => selection.name.value
              )
              const access = await Access.getAccess({
                accessType: 'read',
                modelName: this.schema.name,
                user: context.user
              })
              const filter = QueryFilter.parse(args, '_').intersectWith(
                access.filter
              )
              const {entries} = await this.find({
                fieldSet: FieldSet.intersect(requestedFields, access.fields),
                filter
              })

              return entries.map(entry =>
                entry.toObject({includeModelInstance: true})
              )
            } catch (error) {
              throw new GraphQLError(error)
            }
          }
        }
      }

      // Singular field: retrieves a single entry.
      if (this.graphQLRoutes.singularQuery) {
        const queryName = camelize(this.name)

        queries[queryName] = {
          type,
          args: {
            _id: {type: GraphQLNonNull(GraphQLID)}
          },
          resolve: async (_, {_id: id}, context, info) => {
            try {
              const requestedFields = info.fieldNodes[0].selectionSet.selections.map(
                selection => selection.name.value
              )
              const access = await Access.getAccess({
                accessType: 'read',
                modelName: this.schema.name,
                user: context.user
              })
              const entry = await this.findOneById({
                fieldSet: FieldSet.intersect(requestedFields, access.fields),
                filter: access.filter,
                id
              })

              return entry && entry.toObject({includeModelInstance: true})
            } catch (error) {
              throw new GraphQLError(error)
            }
          }
        }
      }

      return queries
    }
  })
}
