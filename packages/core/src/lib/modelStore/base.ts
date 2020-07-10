import {classify, pluralize, titleize} from 'inflected'

import AccessModel from '../models/access'
import BaseModel from '../model/base'
import {DataConnector} from '../dataConnector/interface'
import {isModelDefinitionClass, ModelDefinition} from '../model/definition'
import logger from '../logger'
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
  models: Map<string, typeof BaseModel>

  constructor() {
    this.models = new Map()
  }

  private buildModel(
    name: string,
    source: ModelDefinition,
    database: DataConnector
  ): typeof BaseModel {
    const handle = this.normalizeHandle(name)
    const isInternalModel = name.startsWith('base$')
    const schema = new Schema({
      fields: source.fields,
      name: handle,
    })
    const modelProperties = {
      base$db: {
        value: database,
      },
      base$handle: {
        value: handle,
      },
      base$handlePlural: {
        value: source.namePlural || pluralize(handle),
      },
      base$graphQL: {
        value: {},
      },
      base$label: {
        value: source.label || pluralize(titleize(name)),
      },
      base$modelStore: {
        value: this,
      },
      base$routes: {
        value: source.routes || {},
      },
      base$schema: {
        value: schema,
      },
      base$settings: {
        value: this.buildSettingsBlock(source, isInternalModel),
      },
      name: {
        value:
          (isModelDefinitionClass(source) && source.name) || classify(name),
      },
    }

    const NewModel = isModelDefinitionClass(source)
      ? class extends source {}
      : class extends BaseModel {}

    logger.debug('Loading model: %s', handle)

    return Object.defineProperties(NewModel, modelProperties)
  }

  private buildSettingsBlock(
    source: ModelDefinition,
    isInternalModel: boolean
  ) {
    const interfaces = INTERFACES.reduce((interfaces, interfaceName) => {
      const modelInterfaces = (source && source.interfaces) || {}
      const value =
        modelInterfaces[interfaceName] !== undefined
          ? modelInterfaces[interfaceName]
          : !isInternalModel

      return {
        ...interfaces,
        [interfaceName]: value,
      }
    }, {})

    return {
      interfaces,
    }
  }

  private normalizeHandle(handle: string) {
    return handle.toString().toLowerCase()
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
      return Model.base$handlePlural === normalizedHandle
    })
  }

  has(handle: string) {
    return this.models.has(this.normalizeHandle(handle))
  }

  hasPluralForm(handlePlural: string) {
    const normalizedHandle = this.normalizeHandle(handlePlural)

    return Array.from(this.models.values()).some((source) => {
      return source.base$handlePlural === normalizedHandle
    })
  }

  load(input: any) {
    const sources = (Array.isArray(input) ? input : [input]).map((source) =>
      this.resolveSourceModule(source)
    )
    const loadedModels: typeof BaseModel[] = []

    sources.forEach((source) => {
      if (!source.name) {
        logger.error(
          'Model using the object syntax is missing a `name` property: %o',
          source
        )

        return
      }

      const Model = this.buildModel(source.name, source, this.dataConnector)

      loadedModels.push(Model)

      this.models.set(this.normalizeHandle(Model.base$handle), Model)
    })

    loadedModels.forEach((Model) => {
      Model.base$schema.loadFieldHandlers()
    })

    return this
  }

  resolveSourceModule(input: any): ModelDefinition {
    return input.__esModule ? input.default : input
  }

  setDataConnector(dataConnector: DataConnector) {
    logger.debug(
      'Setting main data connector: %s',
      dataConnector.constructor.name
    )

    this.dataConnector = dataConnector

    this.load(INTERNAL_MODELS)
  }
}
