const {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType
} = require('graphql')

const capitalizeString = require('../../utils/capitalizeString')
const GraphQLDeleteResponse = require('./deleteResponse')
const GraphQLError = require('./error')
const Model = require('../../model')
const QueryFilter = require('../../queryFilter')

class GraphQLModel extends Model {
  static getGraphQLMutations() {
    const inputFields = this.schema.getGraphQLInputFields()
    const mutations = {
      [`create${this.nameCapitalized}`]: {
        type: this.getGraphQLType(),
        args: inputFields,
        resolve: async (_root, fields) => {
          try {
            const entry = new this(fields)

            await entry.save()

            return entry.toObject({includeModelInstance: true})
          } catch (error) {
            throw new GraphQLError(error)
          }
        }
      },

      [`delete${this.nameCapitalized}`]: {
        type: GraphQLDeleteResponse,
        args: {_id: {type: GraphQLNonNull(GraphQLID)}},
        resolve: async (_root, {_id: id}) => {
          try {
            const {deleteCount} = await this.delete({id})

            return {
              deleteCount
            }
          } catch (error) {
            throw new GraphQLError(error)
          }
        }
      },

      [`update${this.nameCapitalized}`]: {
        type: this.getGraphQLType(),
        args: {
          ...inputFields,
          _id: {type: GraphQLNonNull(GraphQLID)}
        },
        resolve: async (_root, fields) => {
          try {
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
    queries[this.pluralCapitalized] = {
      type: new GraphQLList(type),
      args: this.schema.getGraphQLQueryFilters(),
      resolve: async (_, args) => {
        try {
          const query = QueryFilter.parse(args, '_')
          const {entries} = await this.find({
            query
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
    queries[this.nameCapitalized] = {
      type,
      args: {
        _id: {type: GraphQLNonNull(GraphQLID)}
      },
      resolve: async (_, {_id: id}) => {
        try {
          const entry = await this.findOneById({id})

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
        name: this.nameCapitalized
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
  },
  nameCapitalized: {
    get() {
      return capitalizeString(this.name)
    }
  },
  pluralCapitalized: {
    get() {
      return capitalizeString(this.plural)
    }
  }
})

module.exports = GraphQLModel
