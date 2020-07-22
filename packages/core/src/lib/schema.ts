import {camelize} from 'inflected'
import {
  FieldDefinition as NormalizedFieldDefinition,
  FieldIndexDefinitionWithOptions,
} from '@baseplate/validator'

import {InvalidFieldTypeError} from './errors'
import {ExtendedSchema, FieldDefinition} from './fieldDefinition'
import fieldTypes, {FieldHandler} from './fieldTypes'
import GenericModel from './model/base'
import isPlainObject from './utils/isPlainObject'
import logger from './logger'
import modelStore from './modelStore'
import type QueryFilter from './queryFilter'

export type FieldHandlers = Record<string, FieldHandler | NestedObjectMarker>

export interface Index {
  fields: Record<string, 0 | 1>
  filter?: QueryFilter
  sparse?: boolean
  unique?: boolean
}

export interface NestedObjectMarker {
  __nestedObjectId: string
}

export interface SchemaConstructorParameters {
  fields: Record<string, FieldDefinition>
  name: string
  virtuals?: {[key: string]: Virtual}
}

export interface Virtual {
  get?: Function
  set?: Function
}

export default class Schema {
  fields: Record<string, NormalizedFieldDefinition>
  fieldHandlers: FieldHandlers
  indexes: Index[]
  name: string
  virtuals: {[key: string]: Virtual}

  constructor({fields = {}, name, virtuals}: SchemaConstructorParameters) {
    const normalizedFields = this.normalize(fields)

    this.fields = normalizedFields
    this.fieldHandlers = {}
    this.indexes = this.getIndexes(normalizedFields)
    this.name = name
    this.virtuals = virtuals || {}
  }

  getHandlerForField(
    field: NormalizedFieldDefinition,
    name: string,
    fieldPath: string[] = [this.name]
  ): FieldHandler | NestedObjectMarker {
    fieldPath = fieldPath.concat(name)

    if (field.type === 'primitive' && this.isValidPrimitive(field.subType)) {
      return new fieldTypes.primitives[field.subType]({
        options: field.options,
        path: fieldPath,
      })
    }

    if (field.type === 'reference') {
      const Model = modelStore.get(field.subType)

      if (!Model) {
        throw new InvalidFieldTypeError({
          typeName: field.subType,
        })
      }

      return new fieldTypes.system.reference({
        models: [Model],
        options: field.options,
        path: fieldPath,
      })
    }

    if (field.type === 'array') {
      const primitives: FieldHandler[] = []
      const references: typeof GenericModel[] = []

      field.children.forEach((child: NormalizedFieldDefinition) => {
        if (
          child.type === 'primitive' &&
          this.isValidPrimitive(child.subType)
        ) {
          primitives.push(
            new fieldTypes.primitives[child.subType]({
              options: child.options,
              path: fieldPath,
            })
          )
        } else if (child.type === 'reference') {
          const Model = modelStore.get(child.subType)

          if (!Model) {
            throw new InvalidFieldTypeError({
              typeName: child.subType,
            })
          }

          references.push(Model)
        }
      })

      if (references.length > 0) {
        if (primitives.length > 0) {
          throw new Error('Arrays cannot mix primitives and references')
        }

        return new fieldTypes.system.reference({
          models: references,
          options: field,
          path: fieldPath,
        })
      }

      if (primitives.length > 1) {
        throw new Error('Arrays cannot mix different primitives')
      }

      return new fieldTypes.system.array({
        memberType: primitives[0],
        options: {},
        path: fieldPath,
      })
    }

    if (field.type === 'object') {
      return Object.keys(field.children).reduce(
        (handlers, fieldName) => {
          return {
            ...handlers,
            [fieldName]: this.getHandlerForField(
              <NormalizedFieldDefinition>field.children[fieldName],
              fieldName,
              fieldPath
            ),
          }
        },
        {
          __nestedObjectId: camelize(fieldPath.join('_')),
        }
      )
    }

    throw new InvalidFieldTypeError({typeName: field.type})
  }

  getIndexes(fields: Record<string, NormalizedFieldDefinition>): Index[] {
    return Object.keys(fields).reduce((indexes: Index[], fieldName: string) => {
      const field = fields[fieldName]

      if (field.type === 'object') {
        return indexes.concat(this.getIndexes(field.children))
      }

      if (field.options.unique) {
        return indexes.concat({
          fields: {[fieldName]: 1},
          unique: true,
        })
      }

      if (field.options.index) {
        return indexes.concat({
          fields: {[fieldName]: 1},
          sparse: Boolean(
            isPlainObject(field.options.index) &&
              (<FieldIndexDefinitionWithOptions>field.options.index).sparse
          ),
        })
      }

      return indexes
    }, [])
  }

  isReferenceField(fieldName: string) {
    const field = this.fields[fieldName]

    if (!field) {
      return false
    }

    if (field.type === 'reference') {
      return true
    }

    if (field.type === 'array') {
      const hasReferences = field.children.every(
        (child: NormalizedFieldDefinition) => child.type === 'reference'
      )

      return hasReferences
    }

    return false
  }

  isValidPrimitive(input: any): input is keyof typeof fieldTypes.primitives {
    return input in fieldTypes.primitives
  }

  loadFieldHandlers() {
    this.fieldHandlers = Object.entries(this.fields).reduce(
      (result, [name, field]) => {
        const handler = this.getHandlerForField(field, name)

        if (handler) {
          return {
            ...result,
            [name]: handler,
          }
        }

        return result
      },
      {}
    )

    logger.debug('Loaded field handlers: %s', this.name)
  }

  normalize(
    fields: Record<string, FieldDefinition>
  ): Record<string, NormalizedFieldDefinition> {
    return Object.entries(fields).reduce((normalizedFields, [name, field]) => {
      const normalizedField = this.normalizeField(field)

      if (!normalizedField) {
        return normalizedFields
      }

      return {...normalizedFields, [name]: normalizedField}
    }, {})
  }

  normalizeField(fieldDefinition: FieldDefinition): NormalizedFieldDefinition {
    const field = this.normalizeFieldType(fieldDefinition) as ExtendedSchema<
      any
    >

    if (typeof field.type === 'string') {
      const {type, ...options} = field
      const typeName = type.trim().toLowerCase()

      return {
        type:
          this.isValidPrimitive(typeName) && fieldTypes.primitives[typeName]
            ? 'primitive'
            : 'reference',
        subType: typeName,
        options: options || {},
      }
    }

    if (typeof field.type === 'function') {
      const {type, ...options} = field
      const typeName = type.name.trim().toLowerCase()

      return {
        type:
          this.isValidPrimitive(typeName) && fieldTypes.primitives[typeName]
            ? 'primitive'
            : 'reference',
        subType: typeName,
        options: options || {},
      }
    }

    if (Array.isArray(field.type)) {
      const {type, ...options} = field
      const children = field.type.map((member) => this.normalizeField(member))

      return {
        type: 'array',
        children,
        options: options || {},
      }
    }

    if (isPlainObject(field.type)) {
      const {type, ...options} = field

      return {
        type: 'object',
        children: this.normalize(type),
        options,
      }
    }

    if (isPlainObject(field)) {
      return {
        type: 'object',
        children: this.normalize(field),
        options: {},
      }
    }
  }

  normalizeFieldType(field: FieldDefinition): FieldDefinition {
    if (
      typeof field === 'string' ||
      typeof field === 'function' ||
      Array.isArray(field)
    ) {
      return {
        type: field,
      }
    }

    return field
  }
}
