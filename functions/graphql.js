const graphql = require('graphql')

const createDatastore = require('../lib/datastore/factory')
const GraphQLModel = require('../lib/specs/graphql/model')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const graphQLSchemaStore = require('../lib/specs/graphql/schemaStore')
const modelFactory = require('../lib/modelFactory')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')

const schemas = graphQLSchemaStore.getAll()

module.exports.post = async event => {
  const authTokenData = parseAuthorizationHeader(event.headers.Authorization)
  const user = getUserFromToken(authTokenData)
  const datastore = createDatastore()
  const models = Object.values(schemas).map(schema => {
    return modelFactory(schema.name, schema, {
      datastore,
      ParentClass: GraphQLModel
    })
  })
  const queries = models.reduce(
    (result, Model) => ({
      ...result,
      ...Model.getGraphQLQueries()
    }),
    {}
  )
  const mutations = models.reduce(
    (result, Model) => ({
      ...result,
      ...Model.getGraphQLMutations()
    }),
    {}
  )
  const schema = new graphql.GraphQLSchema({
    query: new graphql.GraphQLObjectType({
      name: 'Query',
      fields: queries
    }),
    mutation: new graphql.GraphQLObjectType({
      name: 'Mutation',
      fields: mutations
    })
  })
  const body = JSON.parse(event.body)
  const result = await graphql.graphql({
    contextValue: {
      datastore,
      user
    },
    schema,
    source: body.query,
    variableValues: body.variables
  })

  return {
    body: JSON.stringify(result),
    statusCode: 200
  }
}
