const {classify, pluralize} = require('inflected')
const path = require('path')

const BaseModel = require('../model')
const requireDirectory = require('../utils/requireDirectory')

const modelPaths = [
  path.resolve(__dirname, '../models'),
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
      const handle = this.normalizeHandle(
        source.handle || source.name || fileName
      )
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
    return this.models.get(this.normalizeHandle(handle))
  }

  getAll() {
    return Array.from(this.models.values())
  }

  getByPluralForm(handlePlural) {
    const normalizedHandle = this.normalizeHandle(handlePlural)

    return Array.from(this.models.values()).find(Model => {
      return Model.handlePlural === normalizedHandle
    })
  }

  has(handle) {
    return this.models.has(this.normalizeHandle(handle))
  }

  hasPluralForm(handlePlural) {
    const normalizedHandle = this.normalizeHandle(handlePlural)

    return Array.from(this.models.values()).some(source => {
      return source.handlePlural === normalizedHandle
    })
  }

  normalizeHandle(handle) {
    return handle.toString().toLowerCase()
  }
}

module.exports = ModelStore
