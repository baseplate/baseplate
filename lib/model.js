const AccessValue = require('./accessValue')
const datastore = require('./datastore')
const {EntryNotFoundError} = require('./errors')
const {validateObject} = require('../packages/validator')

const DEFAULT_PAGE_SIZE = 20

class Model {
  constructor({...fields}, {fromDb} = {}) {
    this._datastore = datastore
    this._dirtyFields = new Set()
    this._lastSync = null

    this.hydrate(fields, {fromDb})
  }

  /**
   * STATIC METHODS
   */

  static async batchFindById({fieldSet, filter, ids}) {
    await this.initialize()

    const results = await datastore.findManyById({
      fieldSet,
      filter,
      ids,
      modelName: this.name
    })
    const batch = ids.map(id => {
      const resultWithId = results.find(
        result => result._id.toString() === id.toString()
      )

      return resultWithId || null
    })

    return batch
  }

  static create({entryFields}) {
    const instance = new this(entryFields)

    return instance.create()
  }

  static async delete({id}) {
    await this.initialize()

    const {n: deleteCount} = await datastore.deleteOneById({
      id,
      modelName: this.name
    })

    return {deleteCount}
  }

  static async find({
    fieldSet,
    filter,
    pageNumber,
    pageSize = DEFAULT_PAGE_SIZE
  }) {
    await this.initialize()

    const {count, results} = await datastore.find({
      fieldSet,
      filter,
      modelName: this.name,
      pageNumber,
      pageSize
    })
    const entries = results.map(fields => new this(fields, {fromDb: true}))
    const totalPages = Math.ceil(count / pageSize)

    return {entries, totalPages}
  }

  static async findOne({fieldSet, filter}) {
    await this.initialize()

    const {results} = await datastore.find({
      fieldSet,
      filter,
      modelName: this.name
    })

    if (results.length === 0) {
      return null
    }

    return new this(results[0], {fromDb: true})
  }

  static async findOneById({fieldSet, filter, id}) {
    const fields = await this.queryBatcher.findById({fieldSet, filter, id})

    if (!fields) return null

    return new this({...fields}, {fromDb: true})
  }

  static async getAccessForUser({accessType, includePublicUser = true, user}) {
    const isAdmin = user && user.get('accessLevel') === 'admin'

    if (isAdmin) {
      return true
    }

    await this.initialize()

    const userQuery = {
      accessType,
      includePublicUser,
      modelName: this.name
    }

    if (user) {
      userQuery.userId = user.id
      userQuery.userModelName = user.constructor.name
    }

    const accessItems = await datastore.getUserAccessForResource(userQuery)
    const access = AccessValue.parse(accessItems, {isUnion: true})

    return access
  }

  static async initialize() {
    await datastore.connect()
  }

  static async update({id, update}) {
    const instance = new this({_id: id, ...update})

    return instance.save()
  }

  /**
   * INSTANCE METHODS
   */

  async create() {
    this.set('_createdAt', Date.now())

    const fields = await this.validate({enforceRequiredFields: true})

    await this.constructor.initialize()

    const fieldsAfterSetters = await this.runFieldSetters(fields)
    const fieldsAfterVirtuals = await this.runVirtualSetters(fieldsAfterSetters)
    const entry = {
      ...fieldsAfterSetters,
      ...this.getFieldDefaults(fieldsAfterSetters),
      ...fieldsAfterVirtuals
    }

    Object.keys({...this._fields, ...this._virtuals}).forEach(fieldName => {
      this._dirtyFields.delete(fieldName)
    })

    const result = await datastore.createOne({
      entry,
      modelName: this.constructor.name
    })

    this.hydrate(result.ops[0], {fromDb: true})

    return this
  }

  get(fieldName) {
    const field = this.constructor.schema.fields[fieldName]

    if (field) {
      return typeof (field.options && field.options.get) === 'function'
        ? field.options.get(this._fields[fieldName])
        : this._fields[fieldName]
    }
  }

  getFieldDefaults(fields) {
    const fieldsWithDefaults = Object.keys(
      this.constructor.schema.fields
    ).reduce((result, fieldName) => {
      const fieldSchema = this.constructor.schema.fields[fieldName]

      if (
        fields[fieldName] === undefined &&
        fieldSchema &&
        fieldSchema.options &&
        fieldSchema.options.default
      ) {
        const defaultValue =
          typeof fieldSchema.options.default === 'function'
            ? fieldSchema.options.default()
            : fieldSchema.options.default

        return {
          ...result,
          [fieldName]: defaultValue
        }
      }

      return result
    }, {})

    return fieldsWithDefaults
  }

  hydrate(fields, {fromDb}) {
    const {schema} = this.constructor

    this._fields = {}
    this._virtuals = {}
    this._unknownFields = {}

    Object.entries(fields).forEach(([name, value]) => {
      if (name === '_id') {
        this.id = value.toString()
      } else if (schema.fields[name] !== undefined) {
        this._fields[name] = value
      } else if (schema.virtuals[name] !== undefined) {
        this._virtuals[name] = value
      } else {
        this._unknownFields[name] = value
      }
    })

    if (fromDb) {
      this._lastSync = Date.now()
    }
  }

  async runFieldSetters(fields) {
    const transformedFields = {}

    await Promise.all(
      Object.keys(fields).map(async fieldName => {
        const fieldSchema = this.constructor.schema.fields[fieldName]
        const value =
          fieldSchema && typeof fieldSchema.options.set === 'function'
            ? await fieldSchema.options.set(fields[fieldName])
            : fields[fieldName]

        transformedFields[fieldName] = value
      })
    )

    return transformedFields
  }

  runVirtualSetters(fields) {
    const fieldsAfterSetters = Object.keys(this._virtuals).reduce(
      async (fieldsAfterSetters, name) => {
        const virtualSchema = this.constructor.schema.virtuals[name]

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

  save() {
    return this.id ? this.update() : this.create()
  }

  set(fieldName, value) {
    this._dirtyFields.add(fieldName)
    this._fields[fieldName] = value
  }

  async sync() {
    const fields = await this.constructor.queryBatcher.findById({id: this.id})

    if (!fields) {
      throw new EntryNotFoundError({id: this.id})
    }

    this.hydrate(fields, {fromDb: true})

    return this
  }

  async toObject({
    fieldSet,
    includeModelInstance,
    includeVirtuals = true
  } = {}) {
    const fields = {}
    const virtuals = {}

    await Promise.all(
      Object.keys(this._fields).map(async name => {
        if (fieldSet && name[0] !== '_' && !fieldSet.includes(name)) {
          return
        }

        const value = await this.get(name)

        fields[name] = value
      })
    )

    if (includeVirtuals) {
      await Promise.all(
        Object.entries(this.constructor.schema.virtuals).map(
          async ([name, virtual]) => {
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
      _id: this.id
    }
  }

  async update() {
    this.set('_updatedAt', Date.now())

    const fields = await this.validate({enforceRequiredFields: false})

    await this.constructor.initialize()

    const update = Object.entries(fields).reduce(
      (update, [fieldName, value]) => {
        if (this._dirtyFields.has(fieldName)) {
          return {
            ...update,
            [fieldName]: value
          }
        }

        return update
      },
      {}
    )

    Object.keys(update).forEach(fieldName => {
      this._dirtyFields.add(fieldName)
    })

    const updatedResult = await datastore.updateOneById({
      id: this.id,
      modelName: this.constructor.name,
      update
    })

    if (!updatedResult) {
      throw new EntryNotFoundError({id: this.id})
    }

    this.hydrate(updatedResult, {fromDb: true})

    return this
  }

  validate({enforceRequiredFields} = {}) {
    return validateObject({
      enforceRequiredFields,
      ignoreFields: Object.keys(this.constructor.schema.virtuals),
      object: {
        ...this._fields,
        ...this._unknownFields
      },
      schema: this.constructor.schema.fields
    })
  }
}

module.exports = Model
