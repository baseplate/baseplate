import {FieldDefinition} from '../fieldDefinition'

export abstract class ClassModelDefinition {
  static customRoutes: Record<string, Record<string, Function>>
  static fields: Record<string, FieldDefinition>
  static handle?: string
  static handlePlural?: string
  static interfaces?: Record<string, boolean>
  static label?: string
}

export interface ObjectModelDefinition {
  customRoutes?: Record<string, Record<string, Function>>
  fields: Record<string, FieldDefinition>
  handle?: string
  handlePlural?: string
  interfaces?: Record<string, boolean>
  label?: string
}

export function isModelDefinitionClass(
  modelDefinition: ModelDefinition
): modelDefinition is typeof ClassModelDefinition {
  return typeof modelDefinition === 'function'
}

export type ModelDefinition =
  | typeof ClassModelDefinition
  | ObjectModelDefinition
