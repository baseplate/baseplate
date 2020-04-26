const {camelize} = require('inflected')
const {ForbiddenError, UnauthorizedError} = require('../../errors')
const {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType
} = require('graphql')

const FieldSet = require('../../fieldSet')
const GraphQLDeleteResponse = require('./deleteResponse')
const GraphQLError = require('./error')
const Model = require('../../model')
const QueryFilter = require('../../queryFilter')

class GraphQLModel extends Model {
  static getGraphQLMutations() {
    const inputFields = this.schema.getGraphQLInputFields()
    const mutations = {
      [camelize(`create_${this.name}`, false)]: {
        type: this.getGraphQLType(),
        args: inputFields,
        resolve: async (_root, fields, context) => {
          try {
            const access = await this.getAccessForUser({
              accessType: 'create',
              user: context.user
            })

            if (access.isDenied()) {
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
      },

      [camelize(`delete_${this.name}`, false)]: {
        type: GraphQLDeleteResponse,
        args: {_id: {type: GraphQLNonNull(GraphQLID)}},
        resolve: async (_root, {_id: id}, context) => {
          try {
            const access = await this.getAccessForUser({
              accessType: 'delete',
              user: context.user
            })

            if (access.isDenied()) {
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
      },

      [camelize(`update_${this.name}`, false)]: {
        type: this.getGraphQLType(),
        args: {
          ...inputFields,
          _id: {type: GraphQLNonNull(GraphQLID)}
        },
        resolve: async (_root, fields, context) => {
          try {
            const access = await this.getAccessForUser({
              accessType: 'create',
              user: context.user
            })

            if (access.isDenied()) {
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
  }

  static getGraphQLQueries() {
    const queries = {}
    const type = this.getGraphQLType()

    // Plural field: retrieves a list of entries.
    queries[camelize(this.plural)] = {
      type: new GraphQLList(type),
      args: this.schema.getGraphQLQueryFilters(),
      resolve: async (_, args, context, info) => {
        try {
          const requestedFields = info.fieldNodes[0].selectionSet.selections.map(
            selection => selection.name.value
          )
          const access = await this.getAccessForUser({
            accessType: 'read',
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

    // Singular field: retrieves a single entry.
    queries[camelize(this.name)] = {
      type,
      args: {
        _id: {type: GraphQLNonNull(GraphQLID)}
      },
      resolve: async (_, {_id: id}, context, info) => {
        try {
          const requestedFields = info.fieldNodes[0].selectionSet.selections.map(
            selection => selection.name.value
          )
          const access = await this.getAccessForUser({
            accessType: 'read',
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

    return queries
  }

  static getGraphQLType() {
    if (!this._graphQLType) {
      this._graphQLType = new GraphQLObjectType({
        fields: this.schema.getGraphQLOutputFields.bind(this.schema, this.name),
        isTypeOf: value => {
          return value.__model && value.__model.constructor === this
        },
        name: camelize(this.name)
      })
    }

    return this._graphQLType
  }
}

Object.defineProperties(GraphQLModel, {
  dateResolver: {
    value: (root, _args, _context, info) => {
      const timestamp = root[info.fieldName]

      if (!timestamp) return null

      const date = new Date(timestamp)

      return date.toISOString()
    }
  }
})

module.exports = GraphQLModel
