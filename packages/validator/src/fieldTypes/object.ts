import {Field, FieldOptions} from '../field'

export default interface FieldObject extends Field {
  children?: Record<string, Field>
  options: FieldOptions
  type: 'object'
}
