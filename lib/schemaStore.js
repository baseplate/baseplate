const {camelize} = require('inflected')
const path = require('path')

const requireDirectory = require('../lib/utils/requireDirectory')
const Schema = require('./schema')

const MODELS_PATH = path.join(process.cwd(), 'models')

class SchemaStore {
  constructor() {
    const models = new Map()
    const schemas = new Map()
    const pluralForms = new Map()
    const sourceFiles = requireDirectory(MODELS_PATH)

    sourceFiles.forEach(({name, source}) => {
      if (typeof source === 'function') {
        const singularName = source.schema.name
        const pluralName = source.schema.plural

        models.set(singularName, source)
        pluralForms.set(pluralName, singularName)
      } else {
        const schema = new Schema({
          ...source,
          name: camelize(source.name || name, false)
        })

        schemas.set(schema.name, schema)
        pluralForms.set(schema.plural, schema.name)
      }
    })
    const getSchemaByName = this.get.bind(this)

    this.models = models
    this.pluralForms = pluralForms
    this.schemas = schemas

    models.forEach(model => {
      model.schema.loadFieldHandlers({getSchemaByName})
    })

    schemas.forEach(schema => {
      schema.loadFieldHandlers({getSchemaByName})
    })
  }

  add(source) {
    if (source instanceof Schema) {
      this.schemas.set(source.name, source)
      this.pluralForms.set(source.plural, source.name)

      source.loadFieldHandlers({getSchemaByName: this.getSchemaByName})
    } else if (typeof source === 'function') {
      this.models.set(source.schema.name, source)
      this.pluralForms.set(source.schema.plural, source.schema.name)

      source.schema.loadFieldHandlers({getSchemaByName: this.getSchemaByName})
    }
  }

  get(name, isPlural) {
    const key = isPlural ? this.pluralForms.get(name) : name

    return this.schemas.get(key) || this.models.get(key)
  }
}

module.exports = new SchemaStore()
