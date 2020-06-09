const graphql = require('graphql')

const getGraphQLModel = require('../lib/specs/graphql/getGraphQLModel')
const getUserFromToken = require('../lib/acl/getUserFromToken')
const modelStore = require('../lib/specs/graphql/modelStore')
const parseAuthorizationHeader = require('../lib/acl/parseAuthorizationHeader')

module.exports.handler = async (req, res) => {
  const {body, headers} = req
  const authTokenData = parseAuthorizationHeader(headers.authorization)
  const context = {
    user: getUserFromToken(authTokenData, modelStore),
  }
  const Access = modelStore.get('base_access')
  const graphQLModels = modelStore.getAll(context).map((Model) => {
    return getGraphQLModel({Access, Model})
  })
  const queries = graphQLModels.reduce((queries, Model) => {
    return {
      ...queries,
      ...Model.getGraphQLQueries(),
    }
  }, {})
  const mutations = graphQLModels.reduce((result, Model) => {
    return {
      ...result,
      ...Model.getGraphQLMutations(),
    }
  }, {})
  const schema = new graphql.GraphQLSchema({
    query: new graphql.GraphQLObjectType({
      name: 'Query',
      fields: queries,
    }),
    mutation: new graphql.GraphQLObjectType({
      name: 'Mutation',
      fields: mutations,
    }),
  })
  const result = await graphql.graphql({
    contextValue: context,
    schema,
    source: body.query,
    variableValues: body.variables,
  })

  res.status(200).json(result)
}
