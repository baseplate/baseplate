import {isPlainObject} from './utils/'

export type FieldIndexDefinition = boolean | FieldIndexExtendedDefinition

export type FieldIndexExtendedDefinition = {
  sparse?: boolean
  unique?: boolean
}

export interface Index {
  fields: Record<string, -1 | 1>
  sparse?: boolean
  unique?: boolean
}

export interface SchemaIndexDefinition extends FieldIndexExtendedDefinition {
  fields?: Record<string, number>
}

export function getSchemaFields(scope: 'field' | 'schema') {
  return {
    fields: {
      fields: {
        allowed: scope === 'schema',
        required: scope === 'schema',
        type: 'Mixed',
        validate: (input: any) => {
          if (!isPlainObject(input)) {
            return false
          }

          return Object.values(input).every(
            (value) => value === -1 || value === 1
          )
        },
        errorMessage:
          'Must be an object mappin field names to a sort order (i.e. -1 or 1)',
      },
      sparse: Boolean,
      unique: Boolean,
    },
  }
}
