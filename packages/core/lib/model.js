const {EntryNotFoundError} = require('./errors')
const {CustomError, FieldValidationError} = require('../../validator/errors')
const {validateObject} = require('../../../packages/validator')
const FieldSet = require('./fieldSet')

const DEFAULT_PAGE_SIZE = 20
const INTERNAL_FIELDS = ['_createdAt', '_id', '_updatedAt']

class Model {
  constructor({...fields}, {fromDb} = {}) {
    this._createdAt = undefined
    this._dirtyFields = new Set(fromDb ? [] : Object.keys(fields))
    this._lastSync = undefined
    this._updatedAt = undefined

    this._hydrate(fields, {fromDb})
  }

  /**
   * STATIC METHODS
   */

  static create({entryFields}) {
    const instance = new this(entryFields)

    return instance._create()
  }

  static delete({id}) {
    return this.datastore.deleteOneById({
      id,
      Model: this
    })
  }

  static async find({
    fieldSet,
    filter,
    pageNumber,
    pageSize = DEFAULT_PAGE_SIZE,
    sort
  }) {
    const {count, results} = await this.datastore.find({
      fieldSet: FieldSet.unite(fieldSet, INTERNAL_FIELDS),
      filter,
      Model: this,
      pageNumber,
      pageSize,
      sort
    })
    const entries = results.map(fields => new this(fields, {fromDb: true}))
    const totalPages = Math.ceil(count / pageSize)

    return {entries, totalPages}
  }

  static async findOne({fieldSet, filter}) {
    const {results} = await this.datastore.find({
      fieldSet: FieldSet.unite(fieldSet, INTERNAL_FIELDS),
      filter,
      Model: this
    })

    if (results.length === 0) {
      return null
    }

    return new this(results[0], {fromDb: true})
  }

  static async findOneById({fieldSet, filter, id}) {
    const fields = await this.datastore.findOneById({
      fieldSet: FieldSet.unite(fieldSet, INTERNAL_FIELDS),
      filter,
      id,
      Model: this
    })

    if (!fields) return null

    return new this({...fields}, {fromDb: true})
  }

  static async update({id, update}) {
    const instance = new this({_id: id, ...update})

    return instance.save()
  }

  /**
   * INSTANCE METHODS
   */

  async _create() {
    const fields = await this.validate({enforceRequiredFields: true})
    const fieldsAfterSetters = await this._runFieldSetters(fields)
    const fieldsAfterVirtuals = await this._runVirtualSetters(
      fieldsAfterSetters
    )
    const entry = {
      ...fieldsAfterSetters,
      ...this._getFieldDefaults(fieldsAfterSetters),
      ...fieldsAfterVirtuals,
      _createdAt: new Date()
    }

    Object.keys({...this._fields, ...this._virtuals}).forEach(fieldName => {
      this._dirtyFields.delete(fieldName)
    })

    const result = await this.constructor.datastore.createOne({
      entry,
      Model: this.constructor,
      schema: this.constructor.schema
    })

    this._hydrate(result, {fromDb: true})

    return this
  }

  _getFieldDefaults(fields) {
    const fieldsWithDefaults = Object.keys(
      this.constructor.schema.fields
    ).reduce((result, fieldName) => {
      const fieldSchema = this.constructor.schema.fields[fieldName]

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
          [fieldName]: defaultValue
        }
      }

      return result
    }, {})

    return fieldsWithDefaults
  }

  _hydrate(fields, {fromDb}) {
    const {schema} = this.constructor

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
      this._lastSync = Date.now()
    }
  }

  async _runFieldSetters(fields) {
    const transformedFields = {}

    await Promise.all(
      Object.keys(fields).map(async fieldName => {
        const fieldSchema = this.constructor.schema.fields[fieldName]

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
              path: [fieldName]
            })
          }
        }

        transformedFields[fieldName] = value
      })
    )

    return transformedFields
  }

  _runVirtualSetters(fields) {
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

  async _update() {
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
      Model: this.constructor,
      update: {
        ...update,
        _updatedAt: new Date()
      }
    })

    if (!updatedResult) {
      throw new EntryNotFoundError({id: this.id})
    }

    this._hydrate(updatedResult, {fromDb: true})

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

  save() {
    return this.id ? this._update() : this._create()
  }

  set(fieldName, value) {
    this._dirtyFields.add(fieldName)
    this._fields[fieldName] = value
  }

  async toObject({
    fieldSet,
    includeModelInstance,
    includeVirtuals = true
  } = {}) {
    const fields = {
      _createdAt: this._createdAt,
      _updatedAt: this._updatedAt
    }
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

  validate({enforceRequiredFields} = {}) {
    return validateObject({
      enforceRequiredFields,
      ignoreFields: INTERNAL_FIELDS,
      object: {
        ...this._fields,
        ...this._unknownFields
      },
      schema: this.constructor.schema.fields
    })
  }
}

module.exports = Model