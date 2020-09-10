import {
  CustomError,
  FieldHandler,
  FieldIndexExtendedDefinition,
  FieldOperator,
  FieldValidationError,
  Schema,
  validateObject,
  Virtual,
} from '@baseplate/schema'

import AccessModel, {AccessType} from '../internalModels/access'
import type {AccessValue} from '../accessValue'
import {
  EntryNotFoundError,
  ForbiddenError,
  InvalidQueryFilterOperatorError,
  UnauthorizedError,
} from '../errors'
import Context from '../context'
import {
  DataConnector,
  FindParameters as DataConnectorFindParameters,
  SearchParameters as DataConnectorSearchParameters,
  UpdateParameters as DataConnectorUpdateParameters,
} from '../dataConnector/interface'
import type {FieldDefinition} from '../fieldDefinition'
import type {GraphQLModelCache} from '../specs/graphql/modelCache'
import {InterfacesBlock} from './definition'
import FieldSet from '../fieldSet'
import type {ModelStore} from '../modelStore'
import QueryFilter from '../queryFilter/'
import QueryFilterBranch from '../queryFilter/branch'
import QueryFilterField from '../queryFilter/field'
import QueryFilterFork from '../queryFilter/fork'
import type SortObject from '../sortObject'
import UserModel from '../internalModels/user'

const DEFAULT_PAGE_SIZE = 20
const INTERNAL_FIELDS = ['_createdAt', '_id', '_updatedAt']

export interface AuthenticateParameters {
  access: AccessValue
  accessType: AccessType
  context: Context
  user: UserModel
}

export interface CreateParameters {
  authenticate?: boolean
  context?: Context
  user?: UserModel
}

export interface DeleteParameters {
  authenticate?: boolean
  context?: Context
  filter: QueryFilter
  user?: UserModel
}

export type Fields = Record<string, any>

export interface FindOneByIdParameters {
  authenticate?: boolean
  batch?: boolean
  cache?: boolean
  context?: Context
  fieldSet?: FieldSet
  id: string
  user?: UserModel
}

export interface FindOneParameters {
  authenticate?: boolean
  batch?: boolean
  cache?: boolean
  context?: Context
  fieldSet?: FieldSet
  filter: QueryFilter
  user?: UserModel
}

export interface FindParameters {
  authenticate?: boolean
  batch?: boolean
  cache?: boolean
  context?: Context
  fieldSet?: FieldSet
  filter?: QueryFilter
  pageNumber?: number
  pageSize?: number
  sort?: SortObject
  user?: UserModel
}

export interface GetAccessParameters {
  accessType: AccessType
  context: Context
  user: UserModel
}

export interface SearchParameters {
  authenticate?: boolean
  cache?: boolean
  context?: Context
  fieldSet?: FieldSet
  filter?: QueryFilter
  pageNumber?: number
  pageSize?: number
  text: string
  user?: UserModel
}

export interface UpdateParameters {
  authenticate?: boolean
  context?: Context
  filter: QueryFilter
  update: Record<string, any>
  user?: UserModel
}

export interface UpdateOneByIdParameters {
  authenticate?: boolean
  context?: Context
  id: string
  update: Record<string, any>
  user?: UserModel
}

export interface ToObjectParameters {
  fieldSet?: FieldSet
  includeModelInstance?: boolean
  includeVirtuals?: boolean
  serialize?: boolean | Function
}

export default class BaseModel {
  base$createdAt: Date
  base$dirtyFields: Set<string>
  base$fields: Fields
  base$lastSync: Date
  base$unknownFields: Fields
  base$updatedAt: Date
  base$virtuals: Fields

  id: string

  constructor(fields: Fields, {fromDb}: {fromDb?: boolean} = {}) {
    this.base$createdAt = undefined
    this.base$dirtyFields = new Set(fromDb ? [] : Object.keys(fields))
    this.base$lastSync = undefined
    this.base$updatedAt = undefined

    this.base$hydrate(fields, {fromDb})
  }

  static base$db?: DataConnector
  static base$fields: Record<string, FieldDefinition>
  static base$graphQL?: GraphQLModelCache
  static base$handle?: string
  static base$handlePlural?: string
  static base$index?: FieldIndexExtendedDefinition[]
  static base$interfaces?: InterfacesBlock
  static base$label?: string
  static base$modelStore?: ModelStore
  static base$routes?: Record<string, Record<string, Function>>
  static base$schema?: Schema
  static base$settings?: {[key: string]: any}
  static base$virtuals?: Record<string, Virtual>

  static base$authenticate?(options: AuthenticateParameters): AccessValue

  static base$beforeFind?(
    parameters: DataConnectorFindParameters
  ): Partial<DataConnectorFindParameters>

  static base$beforeUpdate?(
    parameters: DataConnectorUpdateParameters
  ): Partial<DataConnectorUpdateParameters>

  static async base$find(
    parameters: FindParameters,
    context: Context,
    cache?: boolean
  ) {
    const {filter} = parameters
    const id = filter.getId()

    if (id) {
      filter.removeId()

      const result = await this.base$db.findOneById(
        {...parameters, id},
        this,
        context,
        cache
      )

      return {
        count: result ? 1 : 0,
        results: result ? [result] : [],
      }
    }

    return this.base$db.find(parameters, this, context, cache)
  }

  static async base$findOneById(
    parameters: FindOneByIdParameters,
    context: Context,
    cache?: boolean
  ) {
    return this.base$db.findOneById(parameters, this, context, cache)
  }

  static async base$getAccess({
    accessType,
    context,
    user,
  }: GetAccessParameters) {
    const Access = <typeof AccessModel>this.base$modelStore.get('base$access')

    let access = await Access.getAccess({
      accessType,
      context,
      modelName: this.base$handle,
      user,
    })

    if (typeof this.base$authenticate === 'function') {
      access = this.base$authenticate({access, accessType, context, user})
    }

    if (access.toObject() === false) {
      throw user ? new ForbiddenError() : new UnauthorizedError()
    }

    return access
  }

  static base$isInternal?() {
    return this.base$handle.startsWith('base$')
  }

  static base$processQuery(query: QueryFilter, context: Context) {
    return query.traverse(
      async (node: QueryFilterBranch | QueryFilterField | QueryFilterFork) => {
        if (!(node instanceof QueryFilterField)) {
          return
        }

        const {name, operator} = node
        const fieldHandler = this.base$schema.handlers[name]

        // (!) TO DO: Decide what to do about unknown fields present in a query.
        if (!fieldHandler) {
          return
        }

        const fieldOperators: Record<string, FieldOperator> =
          (<typeof FieldHandler>fieldHandler.constructor).operators ||
          (<typeof FieldHandler>fieldHandler.constructor).defaultOperators

        if (!fieldOperators[operator]) {
          throw new InvalidQueryFilterOperatorError({operator, path: [name]})
        }

        const newNode = await fieldHandler.castQuery({
          context,
          field: node,
          path: [name],
        })

        Object.assign(node, newNode)
      }
    )
  }

  static async base$search(
    parameters: SearchParameters,
    context: Context,
    cache?: boolean
  ) {
    return this.base$db.search(parameters, this, context, cache)
  }

  static base$sync() {
    return this.base$db.sync(this)
  }

  static base$validate(
    fields: object,
    {enforceRequiredFields}: {enforceRequiredFields?: boolean} = {}
  ) {
    return validateObject({
      enforceRequiredFields,
      ignoreFields: INTERNAL_FIELDS,
      object: fields,
      schema: this.base$schema,
    })
  }

  static async create(
    fields: Fields,
    {authenticate = true, context, user}: CreateParameters = {}
  ) {
    if (authenticate) {
      await this.base$getAccess({
        accessType: 'create',
        context,
        user,
      })
    }

    return new this(fields).save()
  }

  static async delete({
    authenticate = true,
    context,
    filter,
    user,
  }: DeleteParameters) {
    if (authenticate) {
      const access = await this.base$getAccess({
        accessType: 'delete',
        context,
        user,
      })

      filter.intersectWith(access.filter)
    }

    return this.base$db.delete(filter, this, context)
  }

  static async find({
    authenticate = true,
    batch = true,
    cache = true,
    context = new Context(),
    fieldSet,
    filter,
    pageNumber,
    pageSize: suppliedPageSize,
    sort,
    user,
  }: FindParameters) {
    const pageSize = suppliedPageSize || DEFAULT_PAGE_SIZE

    if (authenticate) {
      const access = await this.base$getAccess({
        accessType: 'read',
        context,
        user,
      })

      if (access.fields) {
        fieldSet = access.fields.intersectWith(fieldSet)
      }

      if (filter) {
        filter.intersectWith(access.filter)
      }
    }

    let opParameters: DataConnectorFindParameters = {
      batch,
      fieldSet: FieldSet.unite(fieldSet, new FieldSet(INTERNAL_FIELDS)),
      filter,
      pageNumber,
      pageSize,
      sort,
    }

    if (typeof this.base$beforeFind === 'function') {
      Object.assign(opParameters, this.base$beforeFind(opParameters))
    }

    await this.base$processQuery(filter, context)

    const {count, results} = await this.base$find(opParameters, context, cache)
    const entries = results.map(
      (fields: Fields) => new this(fields, {fromDb: true})
    )
    const totalPages = Math.ceil(count / pageSize)

    return {entries, pageSize, totalEntries: count, totalPages}
  }

  static async findOne(parameters: FindOneParameters) {
    const {entries} = await this.find(parameters)

    return entries[0] || null
  }

  static async findOneById({id, ...parameters}: FindOneByIdParameters) {
    return this.findOne({
      ...parameters,
      filter: new QueryFilter({_id: id}),
    })
  }

  static async search({
    authenticate = true,
    cache = true,
    context = new Context(),
    fieldSet,
    filter,
    pageNumber,
    pageSize: suppliedPageSize,
    text,
    user,
  }: SearchParameters) {
    const pageSize = suppliedPageSize || DEFAULT_PAGE_SIZE

    if (authenticate) {
      const access = await this.base$getAccess({
        accessType: 'read',
        context,
        user,
      })

      if (access.fields) {
        fieldSet = access.fields.intersectWith(fieldSet)
      }

      if (filter) {
        filter.intersectWith(access.filter)
      }
    }

    let opParameters: DataConnectorSearchParameters = {
      fieldSet: FieldSet.unite(fieldSet, new FieldSet(INTERNAL_FIELDS)),
      filter,
      pageNumber,
      pageSize,
      text,
    }

    // (!) TO DO: Add beforeSearch
    // if (typeof this.base$beforeFind === 'function') {
    //   Object.assign(opParameters, this.base$beforeFind(opParameters))
    // }

    const {count, results, scores} = await this.base$search(
      opParameters,
      context,
      cache
    )
    const entries = results.map(
      (fields: Fields) => new this(fields, {fromDb: true})
    )
    const totalPages = Math.ceil(count / pageSize)

    return {entries, pageSize, scores, totalEntries: count, totalPages}
  }

  static async update({
    authenticate = true,
    context,
    filter,
    update,
    user,
  }: UpdateParameters) {
    if (authenticate) {
      const access = await this.base$getAccess({
        accessType: 'update',
        context,
        user,
      })

      filter.intersectWith(access.filter)
    }

    const validatedUpdate = await this.base$validate(update, {
      enforceRequiredFields: false,
    })

    let opParameters = {
      filter,
      update: {...validatedUpdate, _updatedAt: new Date()},
    }

    if (typeof this.base$beforeUpdate === 'function') {
      Object.assign(opParameters, this.base$beforeUpdate(opParameters))
    }

    const {results} = await this.base$db.update(
      opParameters.filter,
      opParameters.update,
      this,
      context
    )
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
      await this.base$getAccess({
        accessType: 'update',
        context,
        user,
      })
    }

    const validatedUpdate = await this.base$validate(update, {
      enforceRequiredFields: false,
    })
    const result = await this.base$db.updateOneById(
      id,
      {...validatedUpdate, _updatedAt: new Date()},
      this,
      context
    )

    if (!result) {
      throw new EntryNotFoundError()
    }

    return new this(result, {fromDb: true})
  }

  /**
   * INSTANCE METHODS
   */

  async base$create() {
    Object.keys({...this.base$fields, ...this.base$virtuals}).forEach(
      (fieldName) => {
        this.base$dirtyFields.delete(fieldName)
      }
    )

    this.base$createdAt = new Date()

    const result = await (<typeof BaseModel>this.constructor).base$db.createOne(
      this
    )

    this.base$hydrate(result, {fromDb: true})

    return this
  }

  base$getFieldDefaults(fields: Fields) {
    const fieldsWithDefaults = Object.keys(
      (<typeof BaseModel>this.constructor).base$schema.handlers
    ).reduce((result, fieldName) => {
      const fieldSchema = (<typeof BaseModel>this.constructor).base$schema
        .handlers[fieldName]

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

  base$hydrate(fields: Fields = {}, {fromDb}: {fromDb: boolean}) {
    const {base$schema: schema} = <typeof BaseModel>this.constructor

    this.base$fields = {}
    this.base$virtuals = {}
    this.base$unknownFields = {}

    Object.entries(fields).forEach(([name, value]) => {
      const handler = schema.handlers[name]

      if (fromDb && handler) {
        value = handler.deserialize(value)
      }

      if (name === '_id') {
        this.id = value.toString()
      } else if (name === '_createdAt') {
        this.base$createdAt = value
      } else if (name === '_updatedAt') {
        this.base$updatedAt = value
      } else if (schema.handlers[name] !== undefined) {
        this.base$fields[name] = value
      } else if (schema.virtuals && schema.virtuals[name] !== undefined) {
        this.base$virtuals[name] = value
      } else {
        this.base$unknownFields[name] = value
      }
    })

    if (fromDb) {
      this.base$dirtyFields = new Set()
      this.base$lastSync = new Date()
    }
  }

  async base$runFieldSetters(fields: Fields) {
    const transformedFields: Fields = {}

    await Promise.all(
      Object.keys(fields).map(async (fieldName) => {
        const fieldSchema = (<typeof BaseModel>this.constructor).base$schema
          .handlers[fieldName]

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

  async base$runVirtualSetters(virtuals: Fields) {
    const virtualSchemas =
      (<typeof BaseModel>this.constructor).base$schema.virtuals || {}
    const transformedVirtuals: Fields = {}

    await Promise.all(
      Object.keys(virtuals).map(async (name) => {
        const schema = virtualSchemas[name]

        if (schema && typeof schema.set === 'function') {
          try {
            transformedVirtuals[name] = await schema.set(virtuals[name])
          } catch (error) {
            if (error instanceof CustomError) {
              throw error
            }

            throw new FieldValidationError({
              path: [name],
            })
          }
        }
      })
    )

    return transformedVirtuals
  }

  async base$update() {
    const fields = await (<typeof BaseModel>this.constructor).base$validate(
      {
        ...this.base$fields,
        ...this.base$unknownFields,
      },
      {enforceRequiredFields: false}
    )
    const update = Object.entries(fields).reduce(
      (update, [fieldName, value]) => {
        if (this.base$dirtyFields.has(fieldName)) {
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
      this.base$dirtyFields.add(fieldName)
    })

    const updatedResult = await (<typeof BaseModel>(
      this.constructor
    )).updateOneById({
      id: this.id,
      update: {
        ...update,
        _updatedAt: new Date(),
      },
    })

    if (!updatedResult) {
      throw new EntryNotFoundError()
    }

    this.base$hydrate(updatedResult, {fromDb: true})

    return this
  }

  get(fieldName: string) {
    const field = (<typeof BaseModel>this.constructor).base$schema.handlers[
      fieldName
    ]

    if (field) {
      return typeof (field.options && field.options.get) === 'function'
        ? field.options.get(this.base$fields[fieldName])
        : this.base$fields[fieldName]
    }
  }

  async save() {
    if (this.id) {
      return this.base$update()
    }

    const Model = <typeof BaseModel>this.constructor

    this.base$fields = await Model.base$validate({
      ...this.base$fields,
      ...this.base$unknownFields,
    })
    this.base$createdAt = new Date()

    const result = await Model.base$db.createOne(this)

    this.base$hydrate(result, {fromDb: true})

    return this
  }

  set(fieldName: string, value: any) {
    this.base$dirtyFields.add(fieldName)
    this.base$fields[fieldName] = value
  }

  toJSON() {
    return this.base$fields
  }

  async toObject({
    fieldSet,
    includeModelInstance,
    includeVirtuals = true,
    serialize,
  }: ToObjectParameters = {}): Promise<Fields> {
    const Model = <typeof BaseModel>this.constructor
    const fields: Fields = {
      _createdAt: this.base$createdAt,
      _updatedAt: this.base$updatedAt,
    }
    const virtuals: Fields = {}

    await Promise.all(
      Object.keys(this.base$fields).map(async (name) => {
        if (name[0] !== '_' && fieldSet && !fieldSet.has(name)) {
          return
        }

        const field = Model.base$schema.fields[name]
        const handler = Model.base$schema.handlers[name]

        let value = await this.get(name)

        if (serialize) {
          value = handler.serialize({path: [name], value})

          if (typeof serialize === 'function') {
            value = serialize({field, value})
          }
        }

        fields[name] = value
      })
    )

    if (includeVirtuals) {
      const schemaVirtuals = Model.base$schema.virtuals || {}

      await Promise.all(
        Object.entries(schemaVirtuals).map(
          async ([name, virtual]: [string, Virtual]) => {
            if (
              (fieldSet && !fieldSet.has(name)) ||
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

    const virtualsAfterSetters = await this.base$runVirtualSetters(virtuals)
    const fieldsAfterSetters = await this.base$runFieldSetters(fields)
    const object = {
      ...(includeModelInstance ? {__model: this} : null),
      ...fieldsAfterSetters,
      ...virtualsAfterSetters,
      _id: this.id,
    }
    const objectWithDefaults = {
      ...object,
      ...this.base$getFieldDefaults(object),
    }

    // Removing `undefined` fields.
    return Object.entries(objectWithDefaults).reduce((result, [key, value]) => {
      if (value === undefined) {
        return result
      }

      return {
        ...result,
        [key]: value,
      }
    }, {})
  }
}
