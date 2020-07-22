import BaseModel from './lib/model/base'
import {create as createLogger} from './lib/logger'
import Context from './lib/context'
import * as DataConnector from './lib/dataConnector/interface'
import endpointStore, {EndpointDefinition} from './lib/endpointStore'
import type EntryPoint from './lib/entryPoint'
import type {FieldDefinition} from './lib/fieldDefinition'
import FieldSet from './lib/fieldSet'
import type {Index} from './lib/schema'
import HttpRequest from './lib/http/request'
import HttpResponse from './lib/http/response'
import {ModelDefinition} from './lib/model/definition'
import modelStore from './lib/modelStore'
import QueryFilter, {
  Branch as QueryFilterBranch,
  Field as QueryFilterField,
  Fork as QueryFilterFork,
} from './lib/queryFilter'
import routesGraphQL from './routes/graphql'
import routesRest from './routes/rest'
import SortObject from './lib/sortObject'

interface InitializationParameters {
  endpoints?: EndpointDefinition[]
  models?: ModelDefinition[]
}

export {
  BaseModel,
  Context,
  createLogger,
  DataConnector,
  endpointStore,
  EntryPoint,
  FieldDefinition,
  FieldSet,
  HttpRequest,
  HttpResponse,
  Index,
  InitializationParameters,
  ModelDefinition,
  modelStore,
  QueryFilter,
  QueryFilterBranch,
  QueryFilterField,
  QueryFilterFork,
  routesGraphQL,
  routesRest,
  SortObject,
}
