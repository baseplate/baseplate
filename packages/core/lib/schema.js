const {camelize} = require('inflected')

const {InvalidFieldTypeError} = require('./errors')

class Schema {
  constructor({
    fields = {},
    fieldTypes = require('../../../packages/validator/fieldTypes'),
    name,
    virtuals
  }) {
    const normalizedFields = this.normalize({fields, fieldTypes})

    this.fields = normalizedFields
    this.fieldHandlers = {}
    this.fieldTypes = fieldTypes
    this.name = name
    this.virtuals = virtuals || {}
  }

  getHandlerForField({field, fieldPath = [this.name], modelStore, name}) {
    fieldPath = fieldPath.concat(name)

    if (field.type === 'primitive') {
      return new this.fieldTypes.primitives[field.subType]({
        modelStore,
        options: field.options,
        path: fieldPath
      })
    }

    if (field.type === 'reference') {
      const Model = modelStore.get(field.subType)

      if (!Model) {
        throw new InvalidFieldTypeError({
          typeName: field.subType
        })
      }

      return new this.fieldTypes.system.reference({
        models: [Model],
        modelStore,
        options: field.options,
        path: fieldPath
      })
    }

    if (field.type === 'array') {
      const primitives = []
      const references = []

      field.children.forEach(child => {
        if (child.type === 'primitive') {
          primitives.push(
            new this.fieldTypes.primitives[child.subType]({
              modelStore,
              options: child.options,
              path: fieldPath
            })
          )
        } else if (child.type === 'reference') {
          const Model = modelStore.get(child.subType)

          if (!Model) {
            throw new InvalidFieldTypeError({
              typeName: child.subType
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
          path: fieldPath
        })
      }

      if (primitives.length > 1) {
        throw new Error('Arrays cannot mix different primitives')
      }

      return new this.fieldTypes.system.array({
        memberType: primitives[0],
        modelStore,
        path: fieldPath
      })
    }

    if (field.type === 'object') {
      return Object.keys(field.children).reduce(
        (handlers, fieldName) => {
          return {
            ...handlers,
            [fieldName]: this.getHandlerForField({
              field: field.children[fieldName],
              fieldPath,
              modelStore,
              name: fieldName
            })
          }
        },
        {
          __nestedObjectId: camelize(fieldPath.join('_'))
        }
      )
    }

    throw new InvalidFieldTypeError({typeName: field.type})
  }

  isReferenceField(fieldName) {
    if (!this.fields[fieldName]) {
      return false
    }

    const {children, type} = this.fields[fieldName]

    if (type === 'reference') {
      return true
    }

    if (type === 'array') {
      const hasReferences = children.every(child => child.type === 'reference')

      return hasReferences
    }

    return false
  }

  loadFieldHandlers({modelStore}) {
    this.fieldHandlers = Object.entries(this.fields).reduce(
      (result, [name, field]) => {
        const handler = this.getHandlerForField({field, modelStore, name})

        if (handler) {
          return {
            ...result,
            [name]: handler
          }
        }

        return result
      },
      {}
    )
  }

  normalize({fields, fieldTypes}) {
    return Object.keys(fields).reduce((normalizedFields, name) => {
      const field = fields[name]

      if (typeof field === 'string' || typeof field.type === 'string') {
        const typeName = (typeof field === 'string' ? field : field.type)
          .trim()
          .toLowerCase()
        const {type, ...options} = field

        return {
          ...normalizedFields,
          [name]: {
            type: fieldTypes.primitives[typeName] ? 'primitive' : 'reference',
            subType: typeName,
            options: typeof field === 'string' ? {} : options
          }
        }
      }

      if (typeof field === 'function' || typeof field.type === 'function') {
        const typeName = (typeof field === 'function'
          ? field.name
          : field.type.name
        )
          .trim()
          .toLowerCase()
        const {type, ...options} = field

        return {
          ...normalizedFields,
          [name]: {
            type: fieldTypes.primitives[typeName] ? 'primitive' : 'reference',
            subType: typeName,
            options: typeof field === 'function' ? {} : options
          }
        }
      }

      if (Array.isArray(field) || Array.isArray(field.type)) {
        const members = Array.isArray(field) ? field : field.type
        const {type, ...options} = field

        return {
          ...normalizedFields,
          [name]: {
            type: 'array',
            children: Object.values(
              this.normalize({fields: members, fieldTypes})
            ),
            options: Array.isArray(field) ? {} : options
          }
        }
      }

      if (field.toString() === '[object Object]') {
        return {
          ...normalizedFields,
          [name]: {
            type: 'object',
            children: this.normalize({fields: field, fieldTypes}),
            options: {}
          }
        }
      }

      return normalizedFields
    }, {})
  }
}

module.exports = Schema
