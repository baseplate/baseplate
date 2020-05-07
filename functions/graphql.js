const graphql = require('graphql')

const createDatastore = require('../lib/datastore/factory')
const extendModelWithGraphQL = require('../lib/specs/graphql/extendModel')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const modelStore = require('../lib/specs/graphql/modelStore')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')

const internalModels = [
  require('../lib/internalModels/model'),
  require('../lib/internalModels/user'),
  require('../lib/internalModels/modelAccess')
]

internalModels.forEach(Model => {
  modelStore.add(Model, {loadFieldHandlers: true})
})

module.exports.post = async event => {
  const authTokenData = parseAuthorizationHeader(event.headers.Authorization)
  const context = {
    datastore: createDatastore(),
    user: getUserFromToken(authTokenData, modelStore)
  }
  const Access = modelStore.get('base_modelAccess', {context})
  const modelsWithGraphQL = modelStore.getAll().map(Model => {
    return extendModelWithGraphQL({Access, Model})
  })
  const queries = modelsWithGraphQL.reduce(
    (result, Model) => ({
      ...result,
      ...Model.getGraphQLQueries()
    }),
    {}
  )
  const mutations = modelsWithGraphQL.reduce(
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
    contextValue: context,
    schema,
    source: body.query,
    variableValues: body.variables
  })

  return {
    body: JSON.stringify(result),
    statusCode: 200
  }
}
