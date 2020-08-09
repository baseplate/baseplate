import type {
  BaseHandler,
  ExtendedSchema,
  Index,
  IndexDefinitionWithOptions,
  NormalizedDefinition as NormalizedFieldDefinition,
  RawDefinition as RawFieldDefinition,
} from './field'
import {CustomError, InvalidFieldTypeError} from './errors'
import {
  primitives as basePrimitiveTypes,
  system as baseSystemTypes,
} from '../lib/types/'

interface FieldTypes {
  primitives: Record<string, typeof BaseHandler>
  system: Record<string, typeof BaseHandler>
}

interface ConstructorParameters {
  fields: Record<string, RawFieldDefinition>
  handlers?: FieldTypes
  loadFieldHandlers?: boolean
  virtuals?: Record<string, Virtual>
}

export class Schema {
  fields: Record<string, NormalizedFieldDefinition>
  handlers: Record<string, BaseHandler>
  indexes: Index[]
  virtuals: Record<string, Virtual>
  types: FieldTypes

  constructor({
    fields,
    handlers = {primitives: basePrimitiveTypes, system: baseSystemTypes},
    loadFieldHandlers,
    virtuals,
  }: ConstructorParameters) {
    this.types = handlers

    const fieldDefinitions = this.normalizeFields(fields)

    this.fields = fieldDefinitions
    this.indexes = this.getIndexes(fieldDefinitions)
    this.virtuals = virtuals || {}

    if (loadFieldHandlers) {
      this.loadFieldHandlers()
    }
  }

  getHandlerForField(
    field: NormalizedFieldDefinition,
    name: string,
    fieldPath: string[] = []
  ): BaseHandler {
    fieldPath = fieldPath.concat(name)

    if (field.type === 'reference') {
      return new this.types.system.reference({
        ...field,
        path: fieldPath,
      })
    }

    if (field.type === 'array') {
      return new this.types.system.array({
        ...field,
        path: fieldPath,
      })
    }

    if (field.type === 'object') {
      const children = Object.keys(field.children).reduce(
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
        {}
      )

      return new this.types.system.object({
        children,
        options: {},
        path: fieldPath,
      })
    }

    if (this.isValidPrimitive(field.type)) {
      return new this.types.primitives[field.type]({
        ...field,
        path: fieldPath,
      })
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
            field.options.index &&
              field.options.index.toString() === '[object Object]' &&
              (<IndexDefinitionWithOptions>field.options.index).sparse
          ),
        })
      }

      return indexes
    }, [])
  }

  isValidPrimitive(input: any): input is keyof typeof basePrimitiveTypes {
    return input in this.types.primitives
  }

  loadFieldHandlers() {
    this.handlers = Object.entries(this.fields).reduce(
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
  }

  normalizeField(
    fieldDefinition: RawFieldDefinition
  ): NormalizedFieldDefinition {
    const field = this.normalizeFieldType(fieldDefinition) as ExtendedSchema<
      any
    >

    if (typeof field.type === 'string') {
      const {type, ...options} = field
      const typeName = type.trim().toLowerCase()
      const isPrimitive = this.isValidPrimitive(typeName)

      return {
        type: isPrimitive ? typeName : 'reference',
        children: isPrimitive ? {} : [this.normalizeFieldType(field)],
        options: options || {},
      }
    }

    if (typeof field.type === 'function') {
      const {type, ...options} = field
      const typeName = type.name.trim().toLowerCase()
      const isPrimitive = this.isValidPrimitive(typeName)

      return {
        type: isPrimitive ? typeName : 'reference',
        children: isPrimitive ? {} : [this.normalizeFieldType(field)],
        options: options || {},
      }
    }

    if (Array.isArray(field.type)) {
      const {type, ...options} = field
      const {primitives, references} = field.type.reduce(
        (count, member) => {
          if (this.isValidPrimitive(member)) {
            count.primitives++
          } else {
            count.references++
          }

          return count
        },
        {primitives: 0, references: 0}
      )

      if (references > 0) {
        if (primitives > 0) {
          throw new Error('Arrays cannot mix primitives and references')
        }

        return {
          type: 'reference',
          children: field.type.map(this.normalizeFieldType),
          options,
        }
      }

      if (primitives.length > 1) {
        throw new Error('Arrays cannot mix different primitives')
      }

      return {
        type: 'array',
        children: this.normalizeField(field.type[0]),
        options,
      }
    }

    if (field.type && field.type.toString() === '[object Object]') {
      const {type, ...options} = field

      return {
        type: 'object',
        children: this.normalizeFields(type),
        options,
      }
    }

    if (field && field.toString() === '[object Object]') {
      return {
        type: 'object',
        children: this.normalizeFields(field),
        options: {},
      }
    }
  }

  normalizeFields(
    fields: Record<string, RawFieldDefinition>
  ): Record<string, NormalizedFieldDefinition> {
    return Object.entries(fields).reduce((normalizedFields, [name, field]) => {
      const normalizedField = this.normalizeField(field)

      if (!normalizedField) {
        return normalizedFields
      }

      return {...normalizedFields, [name]: normalizedField}
    }, {})
  }

  normalizeFieldType(field: RawFieldDefinition): RawFieldDefinition {
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

  validateOptions() {
    const errors: CustomError[] = []

    Object.values(this.handlers).forEach((handler) => {
      try {
        handler.validateOptions()
      } catch (error) {
        errors.push(error)
      }
    })

    return errors
  }
}

export interface Virtual {
  get?: Function
  set?: Function
}
