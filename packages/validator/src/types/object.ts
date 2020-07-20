import {Field, FieldOptions} from '../index'

export interface FieldHandler {
  children?: Record<string, Field>
  options: FieldOptions
  type: 'object'
}
