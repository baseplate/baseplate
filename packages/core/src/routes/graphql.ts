import * as graphql from 'graphql'

import Context from '../lib/context'
import {getMutations, getQueries} from '../lib/specs/graphql/modelExtension'
import getUserFromToken from '../lib/acl/getUserFromToken'
import HttpRequest from '../lib/http/request'
import HttpResponse from '../lib/http/response'
import modelStore from '../lib/modelStore'
import parseAuthorizationHeader from '../lib/acl/parseAuthorizationHeader'

export async function handler(req: HttpRequest, res: HttpResponse) {
  const {body, headers} = req
  const authTokenData = parseAuthorizationHeader(headers.authorization)
  const context = new Context({
    base$user: getUserFromToken(authTokenData),
  })
  const mutations: Record<string, any> = {}
  const queries: Record<string, any> = {}

  modelStore.getAll().forEach((Model) => {
    if (Model.base$isInternal()) {
      return
    }

    for (const [key, mutation] of getMutations(Model)) {
      mutations[key] = mutation
    }

    for (const [key, query] of getQueries(Model)) {
      queries[key] = query
    }
  })

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
