import type BaseModel from './base'
import {FieldDefinition} from '../fieldDefinition'

export type InterfacesBlock = {[key in Interfaces]?: boolean}

export enum Interfaces {
  graphQLCreateResource = 'graphQLCreateResource',
  graphQLDeleteResource = 'graphQLDeleteResource',
  graphQLFindResource = 'graphQLFindResource',
  graphQLFindResources = 'graphQLFindResources',
  graphQLUpdateResource = 'graphQLUpdateResource',
  graphQLUpdateResources = 'graphQLUpdateResources',
  restCreateResource = 'restCreateResource',
  restDeleteResource = 'restDeleteResource',
  restFindResource = 'restFindResource',
  restFindResourceField = 'restFindResourceField',
  restFindResourceFieldRelationship = 'restFindResourceFieldRelationship',
  restFindResources = 'restFindResources',
  restUpdateResource = 'restUpdateResource',
}

export interface ObjectModelDefinition {
  fields: Record<string, FieldDefinition>
  name: string
  interfaces?: InterfacesBlock
  label?: string
  plural?: string
  routes?: Record<string, Record<string, Function>>
}

export function isClass(
  modelDefinition: ModelDefinition
): modelDefinition is typeof BaseModel {
  return typeof modelDefinition === 'function'
}

export type ModelDefinition = typeof BaseModel | ObjectModelDefinition
