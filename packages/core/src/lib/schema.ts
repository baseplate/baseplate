import {camelize} from 'inflected'
import {
  Field as NormalizedField,
  FieldHandler,
  Model,
} from '@baseplate/validator'
import isPlainObject from './utils/isPlainObject'
import {InvalidFieldTypeError} from './errors'

interface FieldHandlers {
  primitives: {[key: string]: FieldHandler}
  system: {[key: string]: FieldHandler}
}

interface NestedObjectMarker {
  __nestedObjectId: string
}

type ExtendedSchema<T> = {
  type: T
  options?: object
  [propName: string]: any
}

type FunctionStringOrExtendedSchema =
  | Function
  | string
  | ExtendedSchema<Function | string>

type RawField =
  | object
  | FunctionStringOrExtendedSchema
  | Array<FunctionStringOrExtendedSchema>

export interface Virtual {
  get?: Function
  set?: Function
}

export default class Schema {
  fields: Record<string, NormalizedField>
  fieldHandlers: Record<string, FieldHandler>
  fieldTypes: FieldHandlers
  name: string
  virtuals: {[key: string]: Virtual}

  constructor({
    fields = {},
    fieldTypes = require('@baseplate/validator').types,
    name,
    virtuals,
  }: {
    fields: Record<string, NormalizedField>
    fieldTypes: FieldHandlers
    name: string
    virtuals: {[key: string]: Virtual}
  }) {
    const normalizedFields = this.normalize(fields, fieldTypes)

    this.fields = normalizedFields
    this.fieldHandlers = {}
    this.fieldTypes = fieldTypes
    this.name = name
    this.virtuals = virtuals || {}
  }

  getHandlerForField(
    field: NormalizedField,
    modelStore: any,
    name: string,
    fieldPath: Array<string> = [this.name]
  ): NormalizedField | NestedObjectMarker {
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
      const primitives: Array<NormalizedField> = []
      const references: Array<Model> = []

      field.children.forEach((child) => {
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
              <NormalizedField>field.children[fieldName],
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
        (child) => child.type === 'reference'
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

  normalizeFieldType(field: RawField): RawField {
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

  normalize(
    fields: Record<string, RawField>,
    fieldTypes: FieldHandlers
  ): Record<string, NormalizedField> {
    return Object.keys(fields).reduce((normalizedFields, name) => {
      const field = this.normalizeFieldType(fields[name]) as ExtendedSchema<any>

      if (typeof field.type === 'string') {
        const typeName = field.trim().toLowerCase()

        return {
          ...normalizedFields,
          [name]: {
            type: fieldTypes.primitives[typeName] ? 'primitive' : 'reference',
            subType: typeName,
            options: {},
          },
        }
      }

      if (typeof field.type === 'function') {
        const typeName = field.name.trim().toLowerCase()

        return {
          ...normalizedFields,
          [name]: {
            type: fieldTypes.primitives[typeName] ? 'primitive' : 'reference',
            subType: typeName,
            options: {},
          },
        }
      }

      if (Array.isArray(field.type)) {
        const {type, ...options} = field
        const {children} = this.normalize({children: field.type}, fieldTypes)

        return {
          ...normalizedFields,
          [name]: {
            type: 'array',
            children,
            options: options || {},
          },
        }
      }

      if (isPlainObject(field)) {
        return {
          ...normalizedFields,
          [name]: {
            type: 'object',
            children: this.normalize(field, fieldTypes),
            options: {},
          },
        }
      }

      return normalizedFields
    }, {})
  }
}
