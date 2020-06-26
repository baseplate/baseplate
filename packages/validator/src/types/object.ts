import {Field, FieldOptions} from '../field'

export interface FieldHandler {
  children?: Record<string, Field>
  options: FieldOptions
  type: 'object'
}
