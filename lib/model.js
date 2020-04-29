const {EntryNotFoundError} = require('./errors')
const {validateObject} = require('../packages/validator')
const AccessValue = require('./accessValue')
const QueryFilter = require('./queryFilter')

const DEFAULT_PAGE_SIZE = 20

class Model {
  constructor({...fields}, {fromDb} = {}) {
    this._dirtyFields = new Set(fromDb ? [] : Object.keys(fields))
    this._lastSync = null

    this.hydrate(fields, {fromDb})
  }

  /**
   * STATIC METHODS
   */

  static create({entryFields}) {
    const instance = new this(entryFields)

    return instance.create()
  }

  static async delete({id}) {
    const {n: deleteCount} = await this.datastore.deleteOneById({
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
    const {count, results} = await this.datastore.find({
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
    const {results} = await this.datastore.find({
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
    const fields = await this.datastore.findOneById({
      fieldSet,
      filter,
      id,
      modelName: this.name
    })

    if (!fields) return null

    return new this({...fields}, {fromDb: true})
  }

  static async getAccessForUser({accessType, includePublicUser = true, user}) {
    const isAdmin = user && user.get('accessLevel') === 'admin'

    if (isAdmin) {
      return true
    }

    const entries = await this.datastore.getUserAccess({
      includePublicUser,
      userId: user && user.id
    })
    const modelEntries = entries.filter(entry => entry.model === this.name)
    const accessTypeEntries = modelEntries.map(modelEntry => {
      if (!modelEntry || modelEntry[accessType] === undefined) {
        return false
      }

      if (typeof modelEntry[accessType] === 'boolean') {
        return modelEntry[accessType]
      }

      const filter = modelEntry[accessType].filter
        ? QueryFilter.parse(modelEntry[accessType].filter, '_')
        : undefined

      return {
        ...modelEntry[accessType],
        filter
      }
    })
    const access = AccessValue.parse(accessTypeEntries, {isUnion: true})

    return access
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

    const result = await this.constructor.datastore.createOne({
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
      this._dirtyFields = new Set()
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
    const fields = await this.constructor.datastore.findOneById({
      id: this.id
    })

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

    const updatedResult = await this.constructor.datastore.updateOneById({
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
