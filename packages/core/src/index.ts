import BaseModel from './lib/model/base'
import {create as createLogger} from './lib/logger'
import Context from './lib/context'
import * as DataConnector from './lib/dataConnector/interface'
import endpointStore, {EndpointDefinition} from './lib/endpointStore'
import type EntryPoint from './lib/entryPoint'
import * as errors from './lib/errors'
import type {FieldDefinition} from './lib/fieldDefinition'
import FieldSet from './lib/fieldSet'
import HttpRequest from './lib/http/request'
import HttpResponse from './lib/http/response'
import {ModelDefinition} from './lib/model/definition'
import modelStore from './lib/modelStore'
import QueryFilter from './lib/queryFilter/'
import QueryFilterBranch from './lib/queryFilter/branch'
import QueryFilterField from './lib/queryFilter/field'
import QueryFilterFork from './lib/queryFilter/fork'
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
  errors,
  FieldDefinition,
  FieldSet,
  HttpRequest,
  HttpResponse,
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
