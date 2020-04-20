const path = require('path')

const {SchemaConflictError} = require('./errors')
const fieldTypes = require('../packages/validator/fieldTypes/')
const requireDirectory = require('../lib/utils/requireDirectory')
const Schema = require('./schema')

const MODELS_PATH = path.join(process.cwd(), 'models')

class SchemaStore {
  constructor() {
    const sourceFiles = requireDirectory(MODELS_PATH)
    const schemas = sourceFiles.reduce((schemas, {name, source}) => {
      const normalizedName = (source.name || name).toLowerCase()

      if (schemas[normalizedName]) {
        throw new SchemaConflictError({name: normalizedName})
      }

      return {
        ...schemas,
        [normalizedName]: new Schema({
          ...source,
          fieldTypes,
          name: normalizedName
        })
      }
    }, {})

    const getSchemaByName = this.get.bind(this)

    this.schemas = schemas

    Object.values(schemas).forEach(schema => {
      schema.loadFieldHandlers({getSchemaByName})
    })
  }

  get(name) {
    return this.schemas[name]
  }

  getAll() {
    return this.schemas
  }
}

module.exports = new SchemaStore()
