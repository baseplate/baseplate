const {classify, pluralize} = require('inflected')
const path = require('path')

const BaseModel = require('../model')
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

    this.models = sourceFiles.reduce((models, {name: fileName, source}) => {
      const handle = (source.handle || source.name || fileName)
        .toString()
        .toLowerCase()
      const Model = this.buildModel({handle, source})

      return models.set(handle, Model)
    }, new Map())

    this.models.forEach(Model => {
      Model.schema.loadFieldHandlers({modelStore: this})
    })
  }

  buildModel({handle, source}) {
    const isBaseModel = handle.startsWith('base_')
    const schema = new this.SchemaClass({
      fields: source.fields,
      name: handle
    })
    const modelProperties = {
      isBaseModel: {
        value: isBaseModel
      },
      handle: {
        value: handle
      },
      handlePlural: {
        value: source.handlePlural || pluralize(handle)
      },
      name: {
        value: source.name || classify(handle)
      },
      schema: {
        value: schema
      },
      settings: {
        value: this.buildSettingsBlock({isBaseModel, source})
      },
      store: {
        value: this
      }
    }
    const Model =
      typeof source === 'function'
        ? class extends source {}
        : class extends BaseModel {}

    return Object.defineProperties(Model, modelProperties)
  }

  buildSettingsBlock({isBaseModel, source}) {
    const interfaces = INTERFACES.reduce((interfaces, interfaceName) => {
      const modelInterfaces = (source && source.interfaces) || {}
      const value =
        modelInterfaces[interfaceName] !== undefined
          ? modelInterfaces[interfaceName]
          : !isBaseModel

      return {
        ...interfaces,
        [interfaceName]: value
      }
    }, {})

    return {
      interfaces
    }
  }

  get(handle) {
    return this.models.get(handle)
  }

  getAll() {
    return Array.from(this.models.values())
  }

  getByPluralForm(handlePlural) {
    return Array.from(this.models.values()).find(Model => {
      return Model.handlePlural === handlePlural
    })
  }

  getSchema(handle) {
    const Model = this.models.get(handle)

    if (!Model) return

    return Model.schema
  }

  getSchemaByPluralForm(handlePlural) {
    const Model = Array.from(this.models.values()).find(Model => {
      return Model.handlePlural === handlePlural
    })

    if (!Model) return

    return Model.schema
  }

  has(handle) {
    return this.models.has(handle)
  }

  hasPluralForm(handlePlural) {
    return Array.from(this.models.values()).some(source => {
      return source.handlePlural === handlePlural
    })
  }
}

module.exports = ModelStore
