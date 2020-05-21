const {pluralize} = require('inflected')
const path = require('path')

const BaseModel = require('../model')
const createDatastore = require('../datastore/factory')
const requireDirectory = require('../utils/requireDirectory')

const modelPaths = [
  path.resolve(__dirname, '../internalModels'),
  path.join(process.cwd(), 'models')
]
const sourceFiles = modelPaths.reduce(
  (files, path) => files.concat(requireDirectory(path)),
  []
)

const INTERFACES = [
  'graphQLCreateMutation',
  'graphQLDeleteMutation',
  'graphQLPluralQuery',
  'graphQLSingularQuery',
  'graphQLUpdateMutation',
  'jsonApiCreateResource',
  'jsonApiDeleteResource',
  'jsonApiFetchResource',
  'jsonApiFetchResourceField',
  'jsonApiFetchResourceFieldRelationship',
  'jsonApiFetchResources',
  'jsonApiUpdateResource'
]

class ModelStore {
  constructor(SchemaClass) {
    this.SchemaClass = SchemaClass

    this.sources = sourceFiles.reduce(
      (sources, {name: fileName, source: sourceFile}) => {
        const name = (sourceFile.name || fileName).toString().toLowerCase()
        const pluralForm = sourceFile.pluralForm || pluralize(name)
        const source = {
          isBaseModel: name.startsWith('base_'),
          modelClass: typeof sourceFile === 'function' ? sourceFile : undefined,
          name,
          pluralForm,
          schema: new this.SchemaClass({
            fields: sourceFile.fields,
            name
          })
        }

        source.settings = this.buildSettingsBlock(source)

        return sources.set(name, source)
      },
      new Map()
    )

    this.sources.forEach(Model => {
      Model.schema.loadFieldHandlers({modelStore: this})
    })
  }

  buildModel(source, context = {}) {
    const modelProperties = {
      datastore: {
        value: context.datastore || createDatastore()
      },
      isBaseModel: {
        value: source.isBaseModel
      },
      name: {
        value: source.name
      },
      pluralForm: {
        value: source.pluralForm
      },
      schema: {
        value: source.schema
      },
      settings: {
        value: source.settings
      },
      store: {
        value: this
      }
    }
    const Model = source.modelClass
      ? class extends source.modelClass {}
      : class extends BaseModel {}

    return Object.defineProperties(Model, modelProperties)
  }

  buildSettingsBlock(source) {
    const interfaces = INTERFACES.reduce((interfaces, interfaceName) => {
      const modelInterfaces =
        (source.modelClass && source.modelClass.interfaces) || {}
      const value =
        modelInterfaces[interfaceName] !== undefined
          ? modelInterfaces[interfaceName]
          : !source.isBaseModel

      return {
        ...interfaces,
        [interfaceName]: value
      }
    }, {})

    return {
      interfaces
    }
  }

  get(name, context) {
    const source = this.sources.get(name)

    if (!source) return

    return this.buildModel(source, context)
  }

  getAll(context) {
    const models = Array.from(this.sources.values()).map(source => {
      return this.buildModel(source, context)
    })

    return models
  }

  getByPluralForm(pluralForm, context) {
    const source = Array.from(this.sources.values()).find(source => {
      return source.pluralForm === pluralForm
    })

    if (!source) return

    return this.buildModel(source, context)
  }

  getSchema(name) {
    const source = this.sources.get(name)

    if (!source) return

    return source.schema
  }

  getSchemaByPluralForm(pluralForm) {
    const source = Array.from(this.sources.values()).find(source => {
      return source.pluralForm === pluralForm
    })

    if (!source) return

    return source.schema
  }

  has(name) {
    return this.sources.has(name)
  }

  hasPluralForm(pluralForm) {
    return Array.from(this.sources.values()).some(source => {
      return source.pluralForm === pluralForm
    })
  }
}

module.exports = ModelStore
