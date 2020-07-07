import {DataConnector} from '../dataConnector'

import type {GraphQLModelCache} from '../specs/graphql/modelCache'
import type ModelStore from '../modelStore/base'
import type Schema from '../schema'

export default abstract class ConnectedModel {
  static base$db: DataConnector
  static base$graphQL: GraphQLModelCache
  static base$handle: string
  static base$handlePlural: string
  static base$label: string
  static base$modelStore: ModelStore
  static base$routes: Record<string, Record<string, Function>>
  static base$schema: Schema
  static base$settings: {[key: string]: any}
}
