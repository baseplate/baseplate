import {classify, pluralize, titleize} from 'inflected'
import path from 'path'

import Model from '../model'
import Schema, {RawField} from '../schema'
import requireDirectory from '../utils/requireDirectory'

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

abstract class Source {
  static fields: Record<string, RawField>
  static handle: string
  static handlePlural: string
  static interfaces: Record<string, boolean>
  static label: string
}

export default class ModelStore {
  models: Map<string, typeof Model>
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

  buildModel(handle: string, source: typeof Source) {
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
        : class extends Model {}

    return Object.defineProperties(NewModel, modelProperties)
  }

  buildSettingsBlock(source: typeof Source, isBaseModel: boolean) {
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
