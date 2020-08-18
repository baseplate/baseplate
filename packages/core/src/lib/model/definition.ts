import type BaseModel from './base'

export type InterfacesBlock = {[key in Interfaces]?: boolean | string}

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
  fields: typeof BaseModel['base$fields']
  index?: typeof BaseModel['base$index']
  name: string
  interfaces?: typeof BaseModel['base$interfaces']
  label?: typeof BaseModel['base$label']
  plural?: string
  routes?: typeof BaseModel['base$handlePlural']
  virtuals?: typeof BaseModel['base$virtuals']
}

export function isClass(
  modelDefinition: ModelDefinition
): modelDefinition is typeof BaseModel {
  return typeof modelDefinition === 'function'
}

export type ModelDefinition = typeof BaseModel | ObjectModelDefinition
