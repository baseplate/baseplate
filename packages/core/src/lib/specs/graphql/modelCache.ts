import type {GraphQLObjectType} from 'graphql'

import type {Mutation, Query} from './modelExtension'

export interface GraphQLModelCache {
  mutations?: Map<string, Mutation>
  objectType?: GraphQLObjectType
  queries?: Map<string, Query>
}
