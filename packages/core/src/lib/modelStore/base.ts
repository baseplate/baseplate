import {classify, pluralize, titleize} from 'inflected'

import {DataConnector} from '@baseplate/data-connector'

import AccessModel from '../models/access'
import GenericModel from '../model/base'
import {isModelDefinitionClass, ModelDefinition} from '../model/definition'
import ModelsModel from '../models/model'
import RefreshTokenModel from '../models/refreshToken'
import Schema from '../schema'
import UserModel from '../models/user'

const INTERNAL_MODELS = [AccessModel, ModelsModel, RefreshTokenModel, UserModel]

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
  dataConnector: DataConnector
  models: Map<string, typeof GenericModel>
  SchemaClass: typeof Schema

  constructor(SchemaClass: typeof Schema) {
    this.SchemaClass = SchemaClass
  }

  buildModel(handle: string, source: ModelDefinition, database: DataConnector) {
    const isBaseModel = handle.startsWith('base_')
    const schema = new this.SchemaClass({
      fields: source.fields,
      name: handle,
    })
    const modelProperties = {
      database: {
        value: database,
      },
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
        value:
          (isModelDefinitionClass(source) && source.name) || classify(handle),
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
    const NewModel = isModelDefinitionClass(source)
      ? class extends source {}
      : class extends GenericModel {}

    return Object.defineProperties(NewModel, modelProperties)
  }

  buildSettingsBlock(source: ModelDefinition, isBaseModel: boolean) {
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

  loadInternalModels() {
    return INTERNAL_MODELS.reduce((models, source) => {
      const Model = this.buildModel(source.handle, source, this.dataConnector)

      return models.set(source.handle, Model)
    }, new Map())
  }

  normalizeHandle(handle: string) {
    return handle.toString().toLowerCase()
  }

  setDataConnector(dataConnector: DataConnector) {
    this.dataConnector = dataConnector

    this.models = this.loadInternalModels()
    this.models.forEach((Model) => {
      Model.schema.loadFieldHandlers({modelStore: this})
    })
  }
}
