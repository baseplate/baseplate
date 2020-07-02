import {
  DataConnector,
  FindManyByIdParameters,
  FindOneByIdParameters,
  FindParameters,
  Result,
  Results,
} from '@baseplate/data-connector'

import type ModelStore from '../modelStore/base'

export default abstract class ConnectedModel {
  static dataConnector: DataConnector
  static isBaseModel: boolean
  static handle: string
  static handlePlural: string
  static label?: string
  static schema: any
  static settings: {[key: string]: any}
  static store: ModelStore
}
