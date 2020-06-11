import {
  CustomError,
  FieldValidationError,
  Validator,
} from '@baseplate/validator'
import Context from './context'
import {DataStore} from './datastore/factory'
import {EntryNotFoundError} from './errors'
import FieldSet, {FieldSetType} from './fieldSet'
import {Virtual as VirtualSchema} from './schema'
import QueryFilter from './queryFilter'
import SortObject from './sortObject'

const DEFAULT_PAGE_SIZE = 20
const INTERNAL_FIELDS = ['_createdAt', '_id', '_updatedAt']

export interface Fields {
  [key: string]: any
}

export interface FindOneParameters {
  context: Context
  fieldSet: FieldSetType
  filter: QueryFilter
}

export interface FindOneByIdParameters {
  context: Context
  fieldSet: FieldSetType
  filter: QueryFilter
  id: string
}

export interface FindParameters {
  context: Context
  fieldSet: FieldSetType
  filter: QueryFilter
  pageNumber: number
  pageSize: number
  sort: SortObject
}

export interface ToObjectParameters {
  fieldSet?: FieldSetType
  includeModelInstance?: boolean
  includeVirtuals?: boolean
}

export interface UpdateParameters {
  filter: QueryFilter
  update: Fields
}

export interface UpdateOneByIdParameters {
  id: string
  update: Fields
}

export default class Model extends DataStore {
  _createdAt: Date
  _dirtyFields: Set<string>
  _fields: Fields
  _lastSync: Date
  _unknownFields: Fields
  _updatedAt: Date
  _virtuals: Fields

  id: string

  constructor(fields: Fields, {fromDb}: {fromDb?: boolean} = {}) {
    super()

    this._createdAt = undefined
    this._dirtyFields = new Set(fromDb ? [] : Object.keys(fields))
    this._lastSync = undefined
    this._updatedAt = undefined

    this.$__modelHydrate(fields, {fromDb})
  }

  /**
   * STATIC METHODS
   */

  static create(fields: Fields) {
    const instance = new this(fields)

    return instance.$__modelCreate()
  }

  static delete({id}: {id: string}) {
    return this.$__dbDeleteOneById(id)
  }

  static async find({
    context,
    fieldSet,
    filter,
    pageNumber,
    pageSize = DEFAULT_PAGE_SIZE,
    sort,
  }: FindParameters) {
    const {count, results} = await this.$__dbFind({
      context,
      fieldSet: FieldSet.unite(fieldSet, INTERNAL_FIELDS),
      filter,
      pageNumber,
      pageSize,
      sort,
    })
    const entries = results.map(
      (fields: Fields) => new this(fields, {fromDb: true})
    )
    const totalPages = Math.ceil(count / pageSize)

    return {entries, totalPages}
  }

  static async findOne({context, fieldSet, filter}: FindOneParameters) {
    const {results} = await this.$__dbFind({
      context,
      fieldSet: FieldSet.unite(fieldSet, INTERNAL_FIELDS),
      filter,
    })

    if (results.length === 0) {
      return null
    }

    return new this(results[0], {fromDb: true})
  }

  static async findOneById({
    context,
    fieldSet,
    filter,
    id,
  }: FindOneByIdParameters) {
    const fields = await this.$__dbFindOneById({
      context,
      fieldSet: FieldSet.unite(fieldSet, INTERNAL_FIELDS),
      filter,
      id,
    })

    if (!fields) return null

    return new this({...fields}, {fromDb: true})
  }

  static async update({filter, update}: UpdateParameters) {
    const {results} = await this.$__dbUpdate(filter, update)
    const entries = results.map(
      (fields: Fields) => new this(fields, {fromDb: true})
    )

    return entries
  }

  static async updateOneById({id, update}: UpdateOneByIdParameters) {
    const filter = QueryFilter.parse({_id: id})
    const {results} = await this.$__dbUpdate(filter, update)

    return new this(results[0], {fromDb: true})
  }

  /**
   * INSTANCE METHODS
   */

  async $__modelCreate() {
    const fields = await this.validate({enforceRequiredFields: true})
    const fieldsAfterSetters = await this.$__modelRunFieldSetters(fields)
    const fieldsAfterVirtuals = await this.$__modelRunVirtualSetters(
      fieldsAfterSetters
    )
    const entry = {
      ...fieldsAfterSetters,
      ...this.$__modelGetFieldDefaults(fieldsAfterSetters),
      ...fieldsAfterVirtuals,
      _createdAt: new Date(),
    }

    Object.keys({...this._fields, ...this._virtuals}).forEach((fieldName) => {
      this._dirtyFields.delete(fieldName)
    })

    const result = await (<typeof Model>this.constructor).$__dbCreateOne(entry)

    this.$__modelHydrate(result, {fromDb: true})

    return this
  }

  $__modelGetFieldDefaults(fields: Fields) {
    const fieldsWithDefaults = Object.keys(
      (<typeof Model>this.constructor).schema.fields
    ).reduce((result, fieldName) => {
      const fieldSchema = (<typeof Model>this.constructor).schema.fields[
        fieldName
      ]

      if (
        fields[fieldName] === undefined &&
        fieldSchema &&
        fieldSchema.options &&
        fieldSchema.options.default !== undefined
      ) {
        const defaultValue =
          typeof fieldSchema.options.default === 'function'
            ? fieldSchema.options.default()
            : fieldSchema.options.default

        return {
          ...result,
          [fieldName]: defaultValue,
        }
      }

      return result
    }, {})

    return fieldsWithDefaults
  }

  $__modelHydrate(fields: Fields, {fromDb}: {fromDb: boolean}) {
    const {schema} = <typeof Model>this.constructor

    this._fields = {}
    this._virtuals = {}
    this._unknownFields = {}

    Object.entries(fields).forEach(([name, value]) => {
      if (name === '_id') {
        this.id = value.toString()
      } else if (name === '_createdAt') {
        this._createdAt = value
      } else if (name === '_updatedAt') {
        this._updatedAt = value
      } else if (schema.fields[name] !== undefined) {
        this._fields[name] = value
      } else if (schema.virtuals[name] !== undefined) {
        this._virtuals[name] = value
      } else {
        this._unknownFields[name] = value
      }
    })

    if (fromDb) {
      this._dirtyFields = new Set()
      this._lastSync = new Date()
    }
  }

  async $__modelRunFieldSetters(fields: Fields) {
    const transformedFields: Fields = {}

    await Promise.all(
      Object.keys(fields).map(async (fieldName) => {
        const fieldSchema = (<typeof Model>this.constructor).schema.fields[
          fieldName
        ]

        let value = fields[fieldName]

        if (fieldSchema && typeof fieldSchema.options.set === 'function') {
          try {
            value = await fieldSchema.options.set(fields[fieldName])
          } catch (error) {
            if (error instanceof CustomError) {
              throw error
            }

            throw new FieldValidationError({
              detail: fieldSchema.options.errorMessage,
              path: [fieldName],
            })
          }
        }

        transformedFields[fieldName] = value
      })
    )

    return transformedFields
  }

  $__modelRunVirtualSetters(fields: Fields) {
    const fieldsAfterSetters = Object.keys(this._virtuals).reduce(
      async (fieldsAfterSetters, name) => {
        const virtualSchema = (<typeof Model>this.constructor).schema.virtuals[
          name
        ]

        if (!virtualSchema || typeof virtualSchema.set !== 'function') {
          return fieldsAfterSetters
        }

        const newFieldsAfterSetters = await fieldsAfterSetters

        return virtualSchema.set(newFieldsAfterSetters)
      },
      fields
    )

    return fieldsAfterSetters
  }

  async $__modelUpdate() {
    const fields = await this.validate({enforceRequiredFields: false})
    const update = Object.entries(fields).reduce(
      (update, [fieldName, value]) => {
        if (this._dirtyFields.has(fieldName)) {
          return {
            ...update,
            [fieldName]: value,
          }
        }

        return update
      },
      {}
    )

    Object.keys(update).forEach((fieldName) => {
      this._dirtyFields.add(fieldName)
    })

    const updatedResult = await (<typeof Model>this.constructor).updateOneById({
      id: this.id,
      update: {
        ...update,
        _updatedAt: new Date(),
      },
    })

    if (!updatedResult) {
      throw new EntryNotFoundError({id: this.id})
    }

    this.$__modelHydrate(updatedResult, {fromDb: true})

    return this
  }

  get(fieldName: string) {
    const field = (<typeof Model>this.constructor).schema.fields[fieldName]

    if (field) {
      return typeof (field.options && field.options.get) === 'function'
        ? field.options.get(this._fields[fieldName])
        : this._fields[fieldName]
    }
  }

  save() {
    return this.id ? this.$__modelUpdate() : this.$__modelCreate()
  }

  set(fieldName: string, value: any) {
    this._dirtyFields.add(fieldName)
    this._fields[fieldName] = value
  }

  async toObject({
    fieldSet,
    includeModelInstance,
    includeVirtuals = true,
  }: ToObjectParameters = {}): Promise<Fields> {
    const fields: Fields = {
      _createdAt: this._createdAt,
      _updatedAt: this._updatedAt,
    }
    const virtuals: Fields = {}

    await Promise.all(
      Object.keys(this._fields).map(async (name) => {
        if (fieldSet && name[0] !== '_' && !fieldSet.includes(name)) {
          return
        }

        const value = await this.get(name)

        fields[name] = value
      })
    )

    if (includeVirtuals) {
      await Promise.all(
        Object.entries((<typeof Model>this.constructor).schema.virtuals).map(
          async ([name, virtual]: [string, VirtualSchema]) => {
            if (
              (fieldSet && !fieldSet.includes(name)) ||
              typeof virtual.get !== 'function'
            ) {
              return
            }

            const value = await virtual.get(fields)

            virtuals[name] = value
          }
        )
      )
    }

    return {
      ...(includeModelInstance ? {__model: this} : null),
      ...fields,
      ...virtuals,
      _id: this.id,
    }
  }

  validate({enforceRequiredFields}: {enforceRequiredFields?: boolean} = {}) {
    return Validator.validateObject({
      enforceRequiredFields,
      ignoreFields: INTERNAL_FIELDS,
      object: {
        ...this._fields,
        ...this._unknownFields,
      },
      schema: (<typeof Model>this.constructor).schema.fields,
    })
  }
}
