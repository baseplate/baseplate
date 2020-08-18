import type {
  BaseHandler,
  ExtendedSchema,
  NormalizedDefinition as NormalizedFieldDefinition,
  RawDefinition as RawFieldDefinition,
} from './field'
import {
  FieldIndexExtendedDefinition,
  getSchemaFields,
  Index,
  SchemaIndexDefinition,
} from './index'
import {isPlainObject} from './utils/'
import {
  CustomError,
  EntryValidationError,
  InvalidFieldTypeError,
} from './errors'
import {
  primitives as basePrimitiveTypes,
  system as baseSystemTypes,
} from '../lib/types/'
import {validateObject} from './validator'

interface ConstructorParameters {
  fields?: Record<string, RawFieldDefinition>
  index?: SchemaIndexDefinition[]
  loadFieldHandlers?: boolean
  normalizedFields?: Record<string, NormalizedFieldDefinition>
  path?: string[]
  types?: FieldTypes
  virtuals?: Record<string, Virtual>
}

interface FieldTypes {
  primitives: Record<string, typeof BaseHandler>
  system: Record<string, typeof BaseHandler>
}

interface SearchIndex {
  fieldPath: string[]
  weight: number
}

export class Schema {
  fields: Record<string, NormalizedFieldDefinition>
  handlers: Record<string, BaseHandler>
  fieldIndexes: Index[]
  path: string[]
  schemaIndexes: Index[]
  searchIndexes: SearchIndex[]
  virtuals: Record<string, Virtual>
  types: FieldTypes

  constructor({
    fields,
    index = [],
    loadFieldHandlers = true,
    normalizedFields,
    path = [],
    types = {primitives: basePrimitiveTypes, system: baseSystemTypes},
    virtuals,
  }: ConstructorParameters = {}) {
    this.types = types

    const fieldDefinitions = normalizedFields || this.normalizeFields(fields)

    this.fields = fieldDefinitions
    this.fieldIndexes = this.getFieldIndexes(fieldDefinitions)
    this.path = path
    this.searchIndexes = this.getSearchIndexes(fieldDefinitions)
    this.schemaIndexes = this.getSchemaIndexes(index)
    this.virtuals = virtuals || {}

    if (loadFieldHandlers) {
      this.loadFieldHandlers()
    }
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
        const indexObject = index as FieldIndexExtendedDefinition

        newIndex.sparse = indexObject.sparse
      }

      indexes.push(newIndex)
    })

    return indexes
  }

  getHandlerForField(
    field: NormalizedFieldDefinition,
    name: string,
    fieldPath: string[] = this.path
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
      const children = new Schema({
        normalizedFields: field.children,
        path: fieldPath,
        types: this.types,
      })

      this.searchIndexes = this.searchIndexes.concat(children.searchIndexes)

      return new this.types.system.object({
        children,
        options: {},
        path: fieldPath,
        type: 'object',
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

  getSchemaIndexes(indexDefinitions: SchemaIndexDefinition[]) {
    return indexDefinitions.map((indexDefinition) => {
      const index: Index = {
        fields: <Record<string, -1 | 1>>indexDefinition.fields,
        unique: indexDefinition.unique,
        sparse: indexDefinition.sparse,
      }

      return index
    })
  }

  getSearchIndexes(fields: Record<string, NormalizedFieldDefinition>) {
    const indexes = Object.keys(fields).reduce((indexes, fieldName: string) => {
      const field = fields[fieldName]
      const {search} = field.options

      if (!search) return indexes

      return indexes.concat({
        fieldPath: this.path.concat(fieldName),
        weight: search.weight,
      })
    }, [])

    return indexes
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

    if (isPlainObject(field.type)) {
      const {type, ...options} = field

      return {
        type: 'object',
        children: this.normalizeFields(type),
        options,
      }
    }

    if (isPlainObject(field)) {
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
    if (!fields) return {}

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

  validate() {
    this.validateFieldIndexes()
    this.validateSchemaIndexes()
  }

  validateFieldIndexes() {
    const errors: CustomError[] = []

    Object.values(this.handlers).forEach((handler) => {
      try {
        handler.validateOptions()
      } catch (error) {
        errors.push(error)
      }
    })

    if (errors.length > 0) {
      throw new EntryValidationError({
        fieldErrors: errors.reduce(
          (errors, error) => errors.concat(error.childErrors),
          []
        ),
        path: this.path,
      })
    }
  }

  validateSchemaIndexes() {
    this.schemaIndexes.forEach((index) => {
      validateObject({
        object: index,
        schema: new Schema(getSchemaFields('schema')),
      })
    })
  }
}

export interface Virtual {
  get?: Function
  set?: Function
}
