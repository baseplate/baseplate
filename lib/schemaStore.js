const {camelize} = require('inflected')
const path = require('path')

const requireDirectory = require('../lib/utils/requireDirectory')
const Schema = require('./schema')

const MODELS_PATH = path.join(process.cwd(), 'models')

class SchemaStore {
  constructor() {
    const sourceFiles = requireDirectory(MODELS_PATH)
    const schemas = sourceFiles.reduce((schemas, {name, source}) => {
      const singularName = camelize(source.name || name, false)

      return {
        ...schemas,
        [singularName]: new Schema({
          ...source,
          name: singularName
        })
      }
    }, {})

    const getSchemaByName = this.get.bind(this)

    this.schemas = schemas

    Object.values(schemas).forEach(schema => {
      schema.loadFieldHandlers({getSchemaByName})
    })
  }

  get(name, isPlural) {
    if (isPlural) {
      return Object.values(this.schemas).find(({plural}) => plural === name)
    }

    return this.schemas[name]
  }

  getAll() {
    return this.schemas
  }
}

module.exports = new SchemaStore()
