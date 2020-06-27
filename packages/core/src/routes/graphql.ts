import * as graphql from 'graphql'

import AccessModel from '../lib/models/access'
import Context from '../lib/context'
import getGraphQLModel from '../lib/specs/graphql/getGraphQLModel'
import getUserFromToken from '../lib/acl/getUserFromToken'
import HttpRequest from '../lib/http/request'
import HttpResponse from '../lib/http/response'
import modelStore from '../lib/specs/graphql/modelStore'
import parseAuthorizationHeader from '../lib/acl/parseAuthorizationHeader'

export default async function handler(req: HttpRequest, res: HttpResponse) {
  const {body, headers} = req
  const authTokenData = parseAuthorizationHeader(headers.authorization)
  const context: Context = {
    user: getUserFromToken(authTokenData, modelStore),
  }
  const Access = <typeof AccessModel>modelStore.get('base_access')
  const graphQLModels = modelStore.getAll().map((Model) => {
    return getGraphQLModel(Model, Access)
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
