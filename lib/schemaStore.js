const {camelize} = require('inflected')
const path = require('path')

const internalUserSchema = require('./internalSchemas/user')
const requireDirectory = require('../lib/utils/requireDirectory')
const Schema = require('./schema')

const MODELS_PATH = path.join(process.cwd(), 'models')

class SchemaStore {
  constructor() {
    const sourceFiles = requireDirectory(MODELS_PATH)
    const sources = sourceFiles.reduce(
      (sources, {name, source}) => {
        const singularName = camelize(source.name || name, false)

        return {
          ...sources,
          [singularName]: new Schema({
            ...source,
            name: singularName
          })
        }
      },
      {_user: internalUserSchema}
    )

    const getSchemaByName = this.get.bind(this)

    this.sources = sources

    Object.values(sources).forEach(source => {
      const schema = SchemaStore.getSchemaFromSource(source)

      schema.loadFieldHandlers({getSchemaByName})
    })
  }

  static getSchemaFromSource(source) {
    if (source instanceof Schema) {
      return source
    }

    if (source.schema instanceof Schema) {
      return source.schema
    }
  }

  get(name, isPlural) {
    if (isPlural) {
      return Object.values(this.sources).find(source => {
        const schema = SchemaStore.getSchemaFromSource(source)

        return schema.plural === name
      })
    }

    return this.sources[name]
  }

  getAll() {
    return this.sources
  }

  getExtendedSchemas() {
    return Object.values(this.sources).filter(
      source => typeof source === 'function'
    )
  }
}

module.exports = new SchemaStore()
