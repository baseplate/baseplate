const {camelize} = require('inflected')
const path = require('path')

const BaseModel = require('../model')
const createDatastore = require('../datastore/factory')
const requireDirectory = require('../utils/requireDirectory')

const modelPaths = [
  path.join(process.cwd(), 'lib', 'internalModels'),
  path.join(process.cwd(), 'models')
]
const sourceFiles = modelPaths.reduce(
  (files, path) => files.concat(requireDirectory(path)),
  []
)

class ModelStore {
  constructor(SchemaClass) {
    this.models = new Map()
    this.pluralForms = new Map()
    this.SchemaClass = SchemaClass

    sourceFiles.forEach(({name, source}) => {
      this.add(source, {loadFieldHandlers: false, name})
    })

    this.models.forEach(Model => {
      Model.schema.loadFieldHandlers({modelStore: this})
    })
  }

  add(source, {loadFieldHandlers, name} = {}) {
    if (typeof source === 'function') {
      const singularName = source.schema.name
      const pluralName = source.schema.plural

      this.models.set(singularName, source)
      this.pluralForms.set(pluralName, singularName)

      if (loadFieldHandlers) {
        source.schema.loadFieldHandlers({modelStore: this})
      }
    } else {
      const Model = Object.assign(class extends BaseModel {}, {
        schema: new this.SchemaClass({
          ...source,
          name: camelize(source.name || name, false)
        })
      })

      this.models.set(Model.schema.name, Model)
      this.pluralForms.set(Model.schema.plural, Model.schema.name)

      if (loadFieldHandlers) {
        Model.schema.loadFieldHandlers({modelStore: this})
      }
    }
  }

  connect(Model, context) {
    const modelProperties = {
      context: {
        value: context
      },
      datastore: {
        value: context.datastore || createDatastore()
      },
      name: {
        enumerable: true,
        value: Model.schema.name
      },
      plural: {
        value: Model.schema.plural
      },
      schema: {
        value: Model.schema
      },
      store: {
        value: this
      }
    }

    const ConnectedModel = class extends Model {}

    Object.defineProperties(ConnectedModel, modelProperties)

    return ConnectedModel
  }

  get(name, {context = {}, isPlural} = {}) {
    const key = isPlural ? this.pluralForms.get(name) : name
    const Model = this.models.get(key)

    if (!Model) return

    return this.connect(Model, context)
  }

  getAll({context = {}} = {}) {
    const models = Array.from(this.models.values()).map(Model => {
      return this.connect(Model, context)
    })

    return models
  }

  getSchema(name, {isPlural} = {}) {
    const key = isPlural ? this.pluralForms.get(name) : name
    const Model = this.models.get(key)

    if (!Model) return

    return Model.schema
  }

  has(name, {isPlural}) {
    const key = isPlural ? this.pluralForms.get(name) : name

    return this.models.has(key)
  }
}

module.exports = ModelStore
