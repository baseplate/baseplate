import {classify, pluralize, titleize} from 'inflected'
import path from 'path'

import GenericModel from '../model/generic'
import ModelDefinition from '../model/definition'
import requireDirectory from '../utils/requireDirectory'
import Schema from '../schema'

const modelPaths = [
  path.resolve(__dirname, '../models'),
  path.join(process.cwd(), 'models'),
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
  'jsonApiUpdateResource',
]

export default class ModelStore {
  models: Map<string, typeof GenericModel>
  SchemaClass: typeof Schema

  constructor(SchemaClass: typeof Schema) {
    this.SchemaClass = SchemaClass

    this.models = sourceFiles.reduce((models, {name: fileName, source}) => {
      const handle = this.normalizeHandle(
        source.handle || source.name || fileName
      )
      const Model = this.buildModel(handle, source)

      return models.set(handle, Model)
    }, new Map())

    this.models.forEach((Model) => {
      Model.schema.loadFieldHandlers({modelStore: this})
    })
  }

  buildModel(handle: string, source: typeof ModelDefinition) {
    const isBaseModel = handle.startsWith('base_')
    const schema = new this.SchemaClass({
      fields: source.fields,
      name: handle,
    })
    const modelProperties = {
      label: {
        value: source.label || pluralize(titleize(handle)),
      },
      isBaseModel: {
        value: isBaseModel,
      },
      handle: {
        value: handle,
      },
      handlePlural: {
        value: source.handlePlural || pluralize(handle),
      },
      name: {
        value: source.name || classify(handle),
      },
      schema: {
        value: schema,
      },
      settings: {
        value: this.buildSettingsBlock(source, isBaseModel),
      },
      store: {
        value: this,
      },
    }
    const NewModel =
      typeof source === 'function'
        ? class extends source {}
        : class extends GenericModel {}

    return Object.defineProperties(NewModel, modelProperties)
  }

  buildSettingsBlock(source: typeof ModelDefinition, isBaseModel: boolean) {
    const interfaces = INTERFACES.reduce((interfaces, interfaceName) => {
      const modelInterfaces = (source && source.interfaces) || {}
      const value =
        modelInterfaces[interfaceName] !== undefined
          ? modelInterfaces[interfaceName]
          : !isBaseModel

      return {
        ...interfaces,
        [interfaceName]: value,
      }
    }, {})

    return {
      interfaces,
    }
  }

  get(handle: string) {
    return this.models.get(this.normalizeHandle(handle))
  }

  getAll() {
    return Array.from(this.models.values())
  }

  getByPluralForm(handlePlural: string) {
    const normalizedHandle = this.normalizeHandle(handlePlural)

    return Array.from(this.models.values()).find((Model) => {
      return Model.handlePlural === normalizedHandle
    })
  }

  has(handle: string) {
    return this.models.has(this.normalizeHandle(handle))
  }

  hasPluralForm(handlePlural: string) {
    const normalizedHandle = this.normalizeHandle(handlePlural)

    return Array.from(this.models.values()).some((source) => {
      return source.handlePlural === normalizedHandle
    })
  }

  normalizeHandle(handle: string) {
    return handle.toString().toLowerCase()
  }
}
