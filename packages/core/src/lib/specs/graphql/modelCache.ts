import type {GraphQLObjectType} from 'graphql'

import type {Mutation, Query, Virtual} from './modelExtension'

export interface GraphQLModelCache {
  inputFields?: Record<string, {type: any}>
  mutations?: Map<string, Mutation>
  objectType?: GraphQLObjectType
  queries?: Map<string, Query>
  virtuals?: Record<string, Virtual>
}
