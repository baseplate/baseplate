import {
  CustomError,
  FieldValidationError,
  Validator,
} from '@baseplate/validator'

import AccessModel, {AccessType} from '../models/access'
import {EntryNotFoundError, ForbiddenError, UnauthorizedError} from '../errors'
import {
  CreateParameters,
  DeleteParameters,
  DeleteOneByIdParameters,
  FindOneByIdParameters,
  FindOneParameters,
  FindParameters,
  UpdateOneByIdParameters,
  UpdateParameters,
} from './interface'
import {Virtual as VirtualSchema} from '../schema'
import Context from '../context'
import FieldSet, {FieldSetType} from '../fieldSet'
import ModelInterfaceWithDataStore from './datastore'
import QueryFilter from '../queryFilter'
import UserModel from '../models/user'

const DEFAULT_PAGE_SIZE = 20
const INTERNAL_FIELDS = ['_createdAt', '_id', '_updatedAt']

interface AuthenticateParameters {
  accessType: AccessType
  context: Context
  fieldSet?: FieldSetType
  filter?: QueryFilter
  user: UserModel
}

type Fields = Record<string, any>

export interface ToObjectParameters {
  fieldSet?: FieldSetType
  includeModelInstance?: boolean
  includeVirtuals?: boolean
}

export default class GenericModel extends ModelInterfaceWithDataStore {
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

    this.base$hydrate(fields, {fromDb})
  }

  /**
   * STATIC METHODS
   */

  static async base$authenticate({
    accessType,
    context,
    fieldSet,
    filter,
    user,
  }: AuthenticateParameters) {
    const Access = <typeof AccessModel>this.store.get('base_access')
    const access = await Access.getAccess({
      accessType,
      context,
      modelName: this.handle,
      user,
    })

    if (access.toObject() === false) {
      throw user ? new ForbiddenError() : new UnauthorizedError()
    }

    if (fieldSet) {
      access.fields = FieldSet.intersect(fieldSet, access.fields)
    }

    if (filter) {
      access.filter = filter.intersectWith(access.filter)
    }

    return access
  }

  static async create(
    fields: Fields,
    {authenticate = true, context, user}: CreateParameters = {}
  ) {
    if (authenticate) {
      await this.base$authenticate({
        accessType: 'create',
        context,
        user,
      })
    }

    const instance = new this(fields)

    return instance.base$create()
  }

  static async delete({
    authenticate = true,
    context,
    filter,
    user,
  }: DeleteParameters) {
    if (authenticate) {
      const access = await this.base$authenticate({
        accessType: 'delete',
        context,
        filter,
        user,
      })

      filter = access.filter
    }

    return this.base$dbDelete(filter)
  }

  static async deleteOneById({
    authenticate = true,
    context,
    id,
    user,
  }: DeleteOneByIdParameters) {
    if (authenticate) {
      await this.base$authenticate({
        accessType: 'delete',
        context,
        user,
      })
    }

    return this.base$dbDeleteOneById(id)
  }

  static async find({
    authenticate = true,
    context,
    fieldSet,
    filter,
    pageNumber,
    pageSize: suppliedPageSize,
    sort,
    user,
  }: FindParameters) {
    const pageSize = suppliedPageSize || DEFAULT_PAGE_SIZE

    if (authenticate) {
      const access = await this.base$authenticate({
        accessType: 'read',
        context,
        fieldSet,
        filter,
        user,
      })

      fieldSet = access.fields
      filter = access.filter
    }

    const {count, results} = await this.base$dbFind({
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

    return {entries, pageSize, totalEntries: count, totalPages}
  }

  static async findOne({
    authenticate = true,
    context,
    fieldSet,
    filter,
    user,
  }: FindOneParameters) {
    if (authenticate) {
      const access = await this.base$authenticate({
        accessType: 'read',
        context,
        fieldSet,
        filter,
        user,
      })

      fieldSet = access.fields
      filter = access.filter
    }

    const {results} = await this.base$dbFind({
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
    authenticate = true,
    context,
    fieldSet,
    filter,
    id,
    user,
  }: FindOneByIdParameters) {
    if (authenticate) {
      const access = await this.base$authenticate({
        accessType: 'read',
        context,
        fieldSet,
        filter,
        user,
      })

      fieldSet = access.fields
      filter = access.filter
    }

    const fields = await this.base$dbFindOneById({
      context,
      fieldSet: FieldSet.unite(fieldSet, INTERNAL_FIELDS),
      filter,
      id,
    })

    if (!fields) return null

    return new this({...fields}, {fromDb: true})
  }

  static async update({
    authenticate = true,
    context,
    filter,
    update,
    user,
  }: UpdateParameters) {
    if (authenticate) {
      const access = await this.base$authenticate({
        accessType: 'delete',
        context,
        filter,
        user,
      })

      filter = access.filter
    }

    const {results} = await this.base$dbUpdate(filter, update)
    const entries = results.map(
      (fields: Fields) => new this(fields, {fromDb: true})
    )

    return entries
  }

  static async updateOneById({
    authenticate = true,
    context,
    id,
    update,
    user,
  }: UpdateOneByIdParameters) {
    if (authenticate) {
      await this.base$authenticate({
        accessType: 'update',
        context,
        user,
      })
    }

    const filter = QueryFilter.parse({_id: id})
    const {results} = await this.base$dbUpdate(filter, update)

    return new this(results[0], {fromDb: true})
  }

  /**
   * INSTANCE METHODS
   */

  async base$create() {
    const fields = await this.validate({enforceRequiredFields: true})
    const fieldsAfterSetters = await this.base$runFieldSetters(fields)
    const fieldsAfterVirtuals = await this.base$runVirtualSetters(
      fieldsAfterSetters
    )
    const entry = {
      ...fieldsAfterSetters,
      ...this.base$getFieldDefaults(fieldsAfterSetters),
      ...fieldsAfterVirtuals,
      _createdAt: new Date(),
    }

    Object.keys({...this._fields, ...this._virtuals}).forEach((fieldName) => {
      this._dirtyFields.delete(fieldName)
    })

    const result = await (<typeof GenericModel>(
      this.constructor
    )).base$dbCreateOne(entry)

    this.base$hydrate(result, {fromDb: true})

    return this
  }

  base$getFieldDefaults(fields: Fields) {
    const fieldsWithDefaults = Object.keys(
      (<typeof GenericModel>this.constructor).schema.fields
    ).reduce((result, fieldName) => {
      const fieldSchema = (<typeof GenericModel>this.constructor).schema.fields[
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

  base$hydrate(fields: Fields, {fromDb}: {fromDb: boolean}) {
    const {schema} = <typeof GenericModel>this.constructor

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

  async base$runFieldSetters(fields: Fields) {
    const transformedFields: Fields = {}

    await Promise.all(
      Object.keys(fields).map(async (fieldName) => {
        const fieldSchema = (<typeof GenericModel>this.constructor).schema
          .fields[fieldName]

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

  base$runVirtualSetters(fields: Fields) {
    const fieldsAfterSetters = Object.keys(this._virtuals).reduce(
      async (fieldsAfterSetters, name) => {
        const virtualSchema = (<typeof GenericModel>this.constructor).schema
          .virtuals[name]

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

  async base$update() {
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

    const updatedResult = await (<typeof GenericModel>(
      this.constructor
    )).updateOneById({
      id: this.id,
      update: {
        ...update,
        _updatedAt: new Date(),
      },
    })

    if (!updatedResult) {
      throw new EntryNotFoundError({id: this.id})
    }

    this.base$hydrate(updatedResult, {fromDb: true})

    return this
  }

  get(fieldName: string) {
    const field = (<typeof GenericModel>this.constructor).schema.fields[
      fieldName
    ]

    if (field) {
      return typeof (field.options && field.options.get) === 'function'
        ? field.options.get(this._fields[fieldName])
        : this._fields[fieldName]
    }
  }

  save() {
    return this.id ? this.base$update() : this.base$create()
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
        Object.entries(
          (<typeof GenericModel>this.constructor).schema.virtuals
        ).map(async ([name, virtual]: [string, VirtualSchema]) => {
          if (
            (fieldSet && !fieldSet.includes(name)) ||
            typeof virtual.get !== 'function'
          ) {
            return
          }

          const value = await virtual.get(fields)

          virtuals[name] = value
        })
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
      schema: (<typeof GenericModel>this.constructor).schema.fields,
    })
  }
}
