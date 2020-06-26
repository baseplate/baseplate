import {camelize} from 'inflected'
import {
  Field,
  FieldDefinition as NormalizedFieldDefinition,
  FieldHandler,
  primitives,
  system,
} from '@baseplate/validator'

import {InvalidFieldTypeError} from './errors'
import {ExtendedSchema, FieldDefinition} from './fieldDefinition'
import GenericModel from './model/generic'
import isPlainObject from './utils/isPlainObject'
import ModelStore from './modelStore/base'

interface FieldHandlers {
  primitives: {[key: string]: FieldHandler}
  system: {[key: string]: FieldHandler}
}

export interface NestedObjectMarker {
  __nestedObjectId: string
}

export interface Virtual {
  get?: Function
  set?: Function
}

export interface SchemaConstructorParameters {
  fields: Record<string, FieldDefinition>
  fieldTypes?: FieldHandlers
  name: string
  virtuals?: {[key: string]: Virtual}
}

export default class Schema {
  fields: Record<string, NormalizedFieldDefinition>
  fieldHandlers: Record<string, Field>
  fieldTypes: FieldHandlers
  name: string
  virtuals: {[key: string]: Virtual}

  constructor({
    fields = {},
    fieldTypes = {primitives, system},
    name,
    virtuals,
  }: SchemaConstructorParameters) {
    const normalizedFields = this.normalize(fields, fieldTypes)

    this.fields = normalizedFields
    this.fieldHandlers = {}
    this.fieldTypes = fieldTypes
    this.name = name
    this.virtuals = virtuals || {}
  }

  getHandlerForField(
    field: NormalizedFieldDefinition,
    modelStore: ModelStore,
    name: string,
    fieldPath: Array<string> = [this.name]
  ): Field | NestedObjectMarker {
    fieldPath = fieldPath.concat(name)

    if (
      field.type === 'primitive' &&
      field.subType in this.fieldTypes.primitives
    ) {
      return new this.fieldTypes.primitives[field.subType]({
        modelStore,
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

      return new this.fieldTypes.system.reference({
        models: [Model],
        modelStore,
        options: field.options,
        path: fieldPath,
      })
    }

    if (field.type === 'array') {
      const primitives: Array<Field> = []
      const references: Array<typeof GenericModel> = []

      field.children.forEach((child: NormalizedFieldDefinition) => {
        if (child.type === 'primitive') {
          primitives.push(
            new this.fieldTypes.primitives[child.subType]({
              modelStore,
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

        return new this.fieldTypes.system.reference({
          models: references,
          modelStore,
          options: field,
          path: fieldPath,
        })
      }

      if (primitives.length > 1) {
        throw new Error('Arrays cannot mix different primitives')
      }

      return new this.fieldTypes.system.array({
        memberType: primitives[0],
        modelStore,
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
              modelStore,
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

  loadFieldHandlers({modelStore}: {modelStore: any}) {
    this.fieldHandlers = Object.entries(this.fields).reduce(
      (result, [name, field]) => {
        const handler = this.getHandlerForField(field, modelStore, name)

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
  }

  normalize(
    fields: Record<string, FieldDefinition>,
    fieldTypes: FieldHandlers
  ): Record<string, NormalizedFieldDefinition> {
    return Object.entries(fields).reduce((normalizedFields, [name, field]) => {
      const normalizedField = this.normalizeField(field, fieldTypes)

      if (!normalizedField) {
        return normalizedFields
      }

      return {...normalizedFields, [name]: normalizedField}
    }, {})
  }

  normalizeField(
    fieldDefinition: FieldDefinition,
    fieldTypes: FieldHandlers
  ): NormalizedFieldDefinition {
    const field = this.normalizeFieldType(fieldDefinition) as ExtendedSchema<
      any
    >

    if (typeof field.type === 'string') {
      const {type, ...options} = field
      const typeName = type.trim().toLowerCase()

      return {
        type: fieldTypes.primitives[typeName] ? 'primitive' : 'reference',
        subType: typeName,
        options: options || {},
      }
    }

    if (typeof field.type === 'function') {
      const {type, ...options} = field
      const typeName = type.name.trim().toLowerCase()

      return {
        type: fieldTypes.primitives[typeName] ? 'primitive' : 'reference',
        subType: typeName,
        options: options || {},
      }
    }

    if (Array.isArray(field.type)) {
      const {type, ...options} = field
      const children = field.type.map((member) =>
        this.normalizeField(member, fieldTypes)
      )

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
        children: this.normalize(type, fieldTypes),
        options,
      }
    }

    if (isPlainObject(field)) {
      return {
        type: 'object',
        children: this.normalize(field, fieldTypes),
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
