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
  index?: IndexDefinitionWithOptions[]
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
    index = [],
    loadFieldHandlers,
    virtuals,
  }: ConstructorParameters) {
    this.types = handlers

    const fieldDefinitions = this.normalizeFields(fields)

    this.fields = fieldDefinitions
    this.indexes = this.getFieldIndexes(fieldDefinitions).concat(
      this.getSchemaIndexes(index)
    )
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
        children: field.children.map(
          (child: NormalizedFieldDefinition, index: number) =>
            this.getHandlerForField(
              child,
              index.toString(),
              fieldPath.concat(index.toString())
            )
        ),
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

  getFieldIndexes(fields: Record<string, NormalizedFieldDefinition>) {
    let indexes: Index[] = []

    Object.keys(fields).forEach((fieldName: string) => {
      const field = fields[fieldName]
      const {children, index, type, unique} = field.options

      if (type === 'object') {
        indexes = indexes.concat(this.getFieldIndexes(children))

        return
      }

      if (!index && !unique) {
        return
      }

      const newIndex: Index = {
        fields: {[fieldName]: 1},
        unique,
      }

      if (index) {
        const indexObject = index as IndexDefinitionWithOptions

        newIndex.filter = indexObject.filter
        newIndex.sparse = indexObject.sparse
      }

      indexes.push(newIndex)
    })

    return indexes
  }

  getSchemaIndexes(indexDefinitions: IndexDefinitionWithOptions[]) {
    return indexDefinitions.map((indexDefinition) => {
      const fields: Record<string, 0 | 1> = Object.entries(
        indexDefinition.fields
      ).reduce((fields, [name, sort]) => {
        if (sort === 0 || sort === 1) {
          return {
            ...fields,
            [name]: sort,
          }
        }

        return fields
      }, {})
      const index: Index = {
        fields,
        unique: indexDefinition.unique,
        sparse: indexDefinition.sparse,
        filter: indexDefinition.filter,
      }

      return index
    })
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
      const children = field.type.map((child) => this.normalizeField(child))
      const {primitives, references} = children.reduce(
        (count, child) => {
          if (child.type === 'reference') {
            count.references++
          } else {
            count.primitives++
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
          children: children.reduce(
            (result, child) => result.concat(child.children),
            []
          ),
          options,
        }
      }

      if (primitives > 1) {
        throw new Error('Arrays cannot mix different primitives')
      }

      return {
        type: 'array',
        children,
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
