import {FieldDefinition} from '../fieldDefinition'

export default abstract class ModelDefinition {
  static customRoutes: Record<string, Record<string, Function>>
  static fields: Record<string, FieldDefinition>
  static handle?: string
  static handlePlural?: string
  static interfaces?: Record<string, boolean>
  static label?: string
}
