import {FieldDefinition} from '../fieldDefinition'

export abstract class ClassModelDefinition {
  static fields: Record<string, FieldDefinition>
  static namePlural?: string
  static interfaces?: Record<string, boolean>
  static label?: string
  static routes: Record<string, Record<string, Function>>
}

export interface ObjectModelDefinition {
  fields: Record<string, FieldDefinition>
  name: string
  namePlural?: string
  interfaces?: Record<string, boolean>
  label?: string
  routes?: Record<string, Record<string, Function>>
}

export function isModelDefinitionClass(
  modelDefinition: ModelDefinition
): modelDefinition is typeof ClassModelDefinition {
  return typeof modelDefinition === 'function'
}

export type ModelDefinition =
  | typeof ClassModelDefinition
  | ObjectModelDefinition
